import { assert } from "chai";
import { BackupStore } from "../../src/store/BackupStore";

async function collect(cursor: AsyncIterable<any>): Promise<any[]> {

    const docs: any[] = [];
    for await (const doc of cursor) docs.push(doc);

    return docs;
}

describe("BackupStore.findAll", () => {

    it("returns a cursor iterating every document in the named collection", async () => {

        const docs = [{ id: "1" }, { id: "2" }];
        const collection = { find: (_filter: any) => (async function* () { for (const d of docs) yield d; })() };
        const db = { collection: (_name: string) => collection } as any;

        const cursor = new BackupStore(db).findAll("users");

        assert.deepEqual(await collect(cursor), docs);
    });

    it("queries the collection matching the given name, with no filter", async () => {

        let queriedName: string | null = null;
        let queriedFilter: any = null;
        const db = {
            collection: (name: string) => {
                queriedName = name;
                return { find: (filter: any) => { queriedFilter = filter; return (async function* () {})(); } };
            },
        } as any;

        new BackupStore(db).findAll("vocabulary");

        assert.equal(queriedName, "vocabulary");
        assert.deepEqual(queriedFilter, {});
    });
});
