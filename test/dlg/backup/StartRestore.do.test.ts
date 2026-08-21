import { assert } from "chai";
import { Readable } from "stream";
import { ObjectId } from "mongodb";
import { StartRestore } from "../../../src/dlg/backup/StartRestore";

/**
 * A mock DB where each named collection tracks its own documents in memory, supporting the
 * `deleteMany`/`insertMany` calls made by `BackupStore.replaceAll`.
 */
function makeMockConfig(collectionNames: string[]) {

    const stored: Record<string, any[]> = {};

    for (const name of collectionNames) stored[name] = [];

    const collections: Record<string, any> = {};

    for (const name of collectionNames) {
        collections[name] = {
            deleteMany: async (_filter: any) => { stored[name] = []; },
            insertMany: async (docs: any[]) => { stored[name].push(...docs); },
        };
    }

    return {
        config: {
            getDBName: () => "test",
            getMongoDb: async () => ({ collection: (name: string) => collections[name] }),
            getCollections: () => collectionNames,
        } as any,
        stored,
    };
}

/**
 * A mock storage client serving backup file content by destination, tracking every
 * `exists`/`createReadStream` call made against it.
 */
function makeMockStorageClient(filesByDestination: Record<string, string>) {

    const existsCalls: string[] = [];
    const readCalls: string[] = [];

    return {
        client: {
            upload: async (_localFilePath: string, _destination: string) => { throw new Error("not used by StartRestore"); },
            deleteIfExists: async (_destination: string) => { throw new Error("not used by StartRestore"); },
            exists: async (destination: string) => { existsCalls.push(destination); return destination in filesByDestination; },
            createReadStream: (destination: string) => { readCalls.push(destination); return Readable.from([filesByDestination[destination]]); },
        },
        existsCalls,
        readCalls,
    };
}

describe("StartRestore.do", () => {

    it("restores collections that have a backup file for the date", async () => {

        const { config, stored } = makeMockConfig(["users", "vocabulary"]);
        const id = new ObjectId().toHexString();
        const { client } = makeMockStorageClient({ "backups/20260821-users.json": `{"_id":"${id}","name":"a"}\n` });
        const delegate = new StartRestore({} as any, config);
        delegate.storageClient = client;

        await delegate.do({ date: "20260821" });

        assert.deepEqual(stored.users.map(d => d.name), ["a"]);
    });

    it("skips collections with no backup file for the date, leaving their data untouched", async () => {

        const { config, stored } = makeMockConfig(["users", "vocabulary"]);
        const id = new ObjectId().toHexString();
        const { client } = makeMockStorageClient({ "backups/20260821-users.json": `{"_id":"${id}"}\n` });
        const delegate = new StartRestore({} as any, config);
        delegate.storageClient = client;

        await delegate.do({ date: "20260821" });

        assert.deepEqual(stored.vocabulary, []);
    });

    it("reports restored and skipped collections in the response", async () => {

        const { config } = makeMockConfig(["users", "vocabulary"]);
        const id = new ObjectId().toHexString();
        const { client } = makeMockStorageClient({ "backups/20260821-users.json": `{"_id":"${id}"}\n` });
        const delegate = new StartRestore({} as any, config);
        delegate.storageClient = client;

        const result = await delegate.do({ date: "20260821" });

        assert.deepEqual(result, { db: { host: null }, restore: "done", date: "20260821", restored: [{ collectionName: "users", total: 1, inserted: 1 }], skipped: ["vocabulary"] });
    });

    it("reads backup files from the backups/<date>-<collection>.json path", async () => {

        const { config } = makeMockConfig(["users"]);
        const id = new ObjectId().toHexString();
        const { client, existsCalls } = makeMockStorageClient({ "backups/20260821-users.json": `{"_id":"${id}"}\n` });
        const delegate = new StartRestore({} as any, config);
        delegate.storageClient = client;

        await delegate.do({ date: "20260821" });

        assert.include(existsCalls, "backups/20260821-users.json");
    });

    it("converts each restored document's _id back to an ObjectId", async () => {

        const { config, stored } = makeMockConfig(["users"]);
        const id = new ObjectId().toHexString();
        const { client } = makeMockStorageClient({ "backups/20260821-users.json": `{"_id":"${id}"}\n` });
        const delegate = new StartRestore({} as any, config);
        delegate.storageClient = client;

        await delegate.do({ date: "20260821" });

        assert.instanceOf(stored.users[0]._id, ObjectId);
        assert.equal(stored.users[0]._id.toHexString(), id);
    });

    it("restores multiple documents from a multi-line backup file", async () => {

        const { config, stored } = makeMockConfig(["users"]);
        const id1 = new ObjectId().toHexString();
        const id2 = new ObjectId().toHexString();
        const { client } = makeMockStorageClient({ "backups/20260821-users.json": `{"_id":"${id1}","name":"a"}\n{"_id":"${id2}","name":"b"}\n` });
        const delegate = new StartRestore({} as any, config);
        delegate.storageClient = client;

        await delegate.do({ date: "20260821" });

        assert.deepEqual(stored.users.map(d => d.name), ["a", "b"]);
    });

    it("throws a 400 ValidationError when no collection has a backup for the date", async () => {

        const { config } = makeMockConfig(["users", "vocabulary"]);
        const { client } = makeMockStorageClient({});
        const delegate = new StartRestore({} as any, config);
        delegate.storageClient = client;

        try {
            await delegate.do({ date: "20260821" });
            assert.fail("expected do() to throw");
        } catch (error: any) {
            assert.equal(error.code, 400);
        }
    });
});
