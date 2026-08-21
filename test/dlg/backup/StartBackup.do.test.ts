import { assert } from "chai";
import * as fs from "fs";
import * as moment from "moment-timezone";
import { StartBackup } from "../../../src/dlg/backup/StartBackup";
import { REFERENCE_TIMEZONE } from "../../../src/Config";

/**
 * A mock DB where each collection yields the given docs from find({}), via a fake
 * async-iterable cursor (mirroring the shape of a real Mongo FindCursor).
 */
function makeMockConfig(collectionDocs: Record<string, any[]>) {

    const collections: Record<string, any> = {};

    for (const [name, docs] of Object.entries(collectionDocs)) {
        collections[name] = { find: (_filter: any) => (async function* () { for (const d of docs) yield d; })() };
    }

    return {
        getDBName: () => "test",
        getMongoDb: async () => ({ collection: (name: string) => collections[name] }),
        getCollections: () => Object.keys(collectionDocs),
    } as any;
}

/**
 * A mock storage client tracking every upload and delete call. `upload` snapshots the local
 * file's content at call time, since the delegate deletes the local file right after.
 */
function makeMockStorageClient() {

    const uploads: { localFilePath: string; destination: string; contentAtUploadTime: string }[] = [];
    const deletes: string[] = [];

    return {
        client: {
            upload: async (localFilePath: string, destination: string) => {
                const contentAtUploadTime = fs.readFileSync(localFilePath, "utf-8");
                uploads.push({ localFilePath, destination, contentAtUploadTime });
            },
            deleteIfExists: async (destination: string) => { deletes.push(destination); },
            exists: async (_destination: string) => false,
            createReadStream: (_destination: string) => { throw new Error("not used by StartBackup"); },
        },
        uploads,
        deletes,
    };
}

describe("StartBackup.do", () => {

    it("uploads a JSON-lines dump of every configured collection", async () => {

        const config = makeMockConfig({ users: [{ id: "u1" }, { id: "u2" }], vocabulary: [{ id: "v1" }] });
        const { client, uploads } = makeMockStorageClient();
        const delegate = new StartBackup({} as any, config);
        delegate.storageClient = client;

        const result = await delegate.do({});

        assert.deepEqual(result, { backup: "done" });
        assert.equal(uploads.length, 2);

        const usersUpload = uploads.find(u => u.destination.endsWith("-users.json"))!;
        assert.equal(usersUpload.contentAtUploadTime, '{"id":"u1"}\n{"id":"u2"}\n');

        const vocabularyUpload = uploads.find(u => u.destination.endsWith("-vocabulary.json"))!;
        assert.equal(vocabularyUpload.contentAtUploadTime, '{"id":"v1"}\n');
    });

    it("names each uploaded file backups/<today as YYYYMMDD>-<collection>.json", async () => {

        const config = makeMockConfig({ users: [] });
        const { client, uploads } = makeMockStorageClient();
        const delegate = new StartBackup({} as any, config);
        delegate.storageClient = client;

        await delegate.do({});

        assert.equal(uploads[0].destination, `backups/${moment.tz(REFERENCE_TIMEZONE).format("YYYYMMDD")}-users.json`);
    });

    it("deletes the local dump file after uploading it", async () => {

        const config = makeMockConfig({ users: [{ id: "u1" }] });
        const { client, uploads } = makeMockStorageClient();
        const delegate = new StartBackup({} as any, config);
        delegate.storageClient = client;

        await delegate.do({});

        assert.isFalse(fs.existsSync(uploads[0].localFilePath), "local dump file must be deleted after upload");
    });

    it("requests deletion of the same-named file from 2 days ago, for every collection", async () => {

        const config = makeMockConfig({ users: [], vocabulary: [] });
        const { client, deletes } = makeMockStorageClient();
        const delegate = new StartBackup({} as any, config);
        delegate.storageClient = client;

        await delegate.do({});

        const staleDay = moment.tz(REFERENCE_TIMEZONE).subtract(2, "days").format("YYYYMMDD");
        assert.sameMembers(deletes, [`${staleDay}-users.json`, `${staleDay}-vocabulary.json`]);
    });

    it("writes an empty dump file for a collection with no documents", async () => {

        const config = makeMockConfig({ users: [] });
        const { client, uploads } = makeMockStorageClient();
        const delegate = new StartBackup({} as any, config);
        delegate.storageClient = client;

        await delegate.do({});

        assert.equal(uploads[0].contentAtUploadTime, "");
    });
});
