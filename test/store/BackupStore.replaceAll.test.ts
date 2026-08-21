import { assert } from "chai";
import { ObjectId } from "mongodb";
import { BackupStore } from "../../src/store/BackupStore";

/**
 * A mock Mongo collection tracking every `deleteMany` and `insertMany` call, backed by an
 * in-memory array so tests can assert on what ends up "stored".
 */
function makeMockCollection() {

    const deleteManyCalls: any[] = [];
    const insertManyCalls: any[][] = [];
    let stored: any[] = [];

    return {
        collection: {
            deleteMany: async (filter: any) => { deleteManyCalls.push(filter); stored = []; },
            insertMany: async (docs: any[]) => { insertManyCalls.push(docs); stored.push(...docs); },
        },
        deleteManyCalls,
        insertManyCalls,
        stored: () => stored,
    };
}

async function* asAsyncIterable(docs: any[]): AsyncGenerator<any> {
    for (const doc of docs) yield doc;
}

describe("BackupStore.replaceAll", () => {

    it("deletes every existing document in the collection before restoring", async () => {

        const { collection, deleteManyCalls } = makeMockCollection();
        const db = { collection: (_name: string) => collection } as any;

        await new BackupStore(db).replaceAll("users", asAsyncIterable([]));

        assert.deepEqual(deleteManyCalls, [{}]);
    });

    it("queries the collection matching the given name", async () => {

        let queriedName: string | null = null;
        const { collection } = makeMockCollection();
        const db = { collection: (name: string) => { queriedName = name; return collection; } } as any;

        await new BackupStore(db).replaceAll("vocabulary", asAsyncIterable([]));

        assert.equal(queriedName, "vocabulary");
    });

    it("restores every document from the given async iterable", async () => {

        const { collection, stored } = makeMockCollection();
        const db = { collection: (_name: string) => collection } as any;
        const id1 = new ObjectId().toHexString();
        const id2 = new ObjectId().toHexString();

        await new BackupStore(db).replaceAll("users", asAsyncIterable([{ _id: id1, name: "a" }, { _id: id2, name: "b" }]));

        assert.equal(stored().length, 2);
        assert.deepEqual(stored().map(d => d.name), ["a", "b"]);
    });

    it("converts each restored document's _id to an ObjectId", async () => {

        const { collection, stored } = makeMockCollection();
        const db = { collection: (_name: string) => collection } as any;
        const id = new ObjectId().toHexString();

        await new BackupStore(db).replaceAll("users", asAsyncIterable([{ _id: id, name: "a" }]));

        assert.instanceOf(stored()[0]._id, ObjectId);
        assert.equal(stored()[0]._id.toHexString(), id);
    });

    it("returns the count of documents restored", async () => {

        const { collection } = makeMockCollection();
        const db = { collection: (_name: string) => collection } as any;

        const count = await new BackupStore(db).replaceAll("users", asAsyncIterable([{ _id: new ObjectId().toHexString() }, { _id: new ObjectId().toHexString() }]));

        assert.equal(count, 2);
    });

    it("returns 0 and issues no insertMany call when the iterable is empty", async () => {

        const { collection, insertManyCalls } = makeMockCollection();
        const db = { collection: (_name: string) => collection } as any;

        const count = await new BackupStore(db).replaceAll("users", asAsyncIterable([]));

        assert.equal(count, 0);
        assert.equal(insertManyCalls.length, 0);
    });

    it("batches inserts at 200 documents per insertMany call", async () => {

        const { collection, insertManyCalls } = makeMockCollection();
        const db = { collection: (_name: string) => collection } as any;
        const docs = Array.from({ length: 450 }, () => ({ _id: new ObjectId().toHexString() }));

        const count = await new BackupStore(db).replaceAll("users", asAsyncIterable(docs));

        assert.equal(count, 450);
        assert.deepEqual(insertManyCalls.map(batch => batch.length), [200, 200, 50]);
    });
});
