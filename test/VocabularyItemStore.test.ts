import { assert } from "chai";
import { VocabularyItemStore } from "../src/store/VocabularyItemStore";
import { VocabularyItem } from "../src/model/VocabularyItem";

function makeItem(overrides: Partial<ConstructorParameters<typeof VocabularyItem>[0]> = {}): VocabularyItem {
    return new VocabularyItem({
        id: "A1-01-n-hus",
        danish: "hus",
        english: "house",
        type: "noun",
        context: null,
        tags: [],
        cefrLevel: "A1",
        source: "curriculum",
        addedByUserId: null,
        ...overrides,
    });
}

function makeMockCollection(docs: any[] = []) {
    const store = [...docs];
    return {
        _docs: store,
        findOne: async (filter: any) => {
            return store.find(doc => {
                if (filter.id !== undefined && doc.id !== filter.id) return false;
                if (filter.danish !== undefined && doc.danish !== filter.danish) return false;
                if (filter.type !== undefined && doc.type !== filter.type) return false;
                if ("context" in filter && doc.context !== filter.context) return false;
                return true;
            }) ?? null;
        },
        find: (filter: any) => {
            const results = filter.$or
                ? store.filter(doc => (filter.$or as any[]).some((f: any) => {
                    if (f.id !== undefined) return doc.id === f.id;
                    return doc.danish === f.danish && doc.type === f.type && doc.context === f.context;
                }))
                : filter.id?.$in
                    ? store.filter(doc => (filter.id.$in as string[]).includes(doc.id))
                    : filter.cefrLevel
                        ? store.filter(doc => doc.cefrLevel === filter.cefrLevel)
                        : [...store];
            return {
                toArray: async () => results,
                sort: () => ({ toArray: async () => [...results].sort((a, b) => a.danish.localeCompare(b.danish)) }),
            };
        },
        insertOne: async (doc: any) => { store.push(doc); return { insertedId: "mock" }; },
        insertMany: async (docs_: any[]) => { docs_.forEach(d => store.push(d)); return {}; },
    };
}

function makeMockDb(collection: any) {
    return { collection: () => collection } as any;
}

// -------------------------------------------------------------------------
// insertOne
// -------------------------------------------------------------------------

describe("VocabularyItemStore.insertOne", () => {

    it("inserts a new item and returns status created", async () => {
        const col = makeMockCollection();
        const store = new VocabularyItemStore(makeMockDb(col));
        const result = await store.insertOne(makeItem());
        assert.equal(result.status, "created");
        assert.equal(result.item.id, "A1-01-n-hus");
    });

    it("returns duplicate_id when an item with the same id already exists", async () => {
        const existing = makeItem().toBSON();
        const col = makeMockCollection([existing]);
        const store = new VocabularyItemStore(makeMockDb(col));
        const result = await store.insertOne(makeItem({ danish: "andet", english: "other" }));
        assert.equal(result.status, "duplicate_id");
    });

    it("DO NOT return duplicate_canonical when (danish, type, context) already exists with a different id", async () => {
        const existing = makeItem({ id: "A1-01-hjem" }).toBSON();
        const col = makeMockCollection([existing]);
        const store = new VocabularyItemStore(makeMockDb(col));
        const result = await store.insertOne(makeItem({ id: "A1-02-hjem" }));
        assert.equal(result.status, "created");
        assert.equal(result.item.id, "A1-02-hjem");
    });

    it("allows two items with the same danish but different type", async () => {
        const existing = makeItem({ id: "ID-1", danish: "stor", type: "adjective" }).toBSON();
        const col = makeMockCollection([existing]);
        const store = new VocabularyItemStore(makeMockDb(col));
        const result = await store.insertOne(makeItem({ id: "ID-2", danish: "stor", type: "noun" }));
        assert.equal(result.status, "created");
    });

    it("allows two items with the same danish and type but different context", async () => {
        const existing = makeItem({ id: "ID-1", danish: "stor", type: "adjective", context: "physical size" }).toBSON();
        const col = makeMockCollection([existing]);
        const store = new VocabularyItemStore(makeMockDb(col));
        const result = await store.insertOne(makeItem({ id: "ID-2", danish: "stor", type: "adjective", context: "importance" }));
        assert.equal(result.status, "created");
    });

});

// -------------------------------------------------------------------------
// insertBatch
// -------------------------------------------------------------------------

describe("VocabularyItemStore.insertBatch", () => {

    it("inserts all new items and reports correct summary", async () => {
        const col = makeMockCollection();
        const store = new VocabularyItemStore(makeMockDb(col));
        const items = [
            makeItem({ id: "ID-1", danish: "hus" }),
            makeItem({ id: "ID-2", danish: "hund", english: "dog" }),
        ];
        const result = await store.insertBatch(items);
        assert.equal(result.inserted, 2);
        assert.equal(result.alreadyPresent, 0);
        assert.isTrue(result.items.every(i => i.status === "created"));
    });

    it("skips duplicate by id and returns correct summary", async () => {
        const existing = makeItem({ id: "ID-1" }).toBSON();
        const col = makeMockCollection([existing]);
        const store = new VocabularyItemStore(makeMockDb(col));
        const items = [
            makeItem({ id: "ID-1" }),
            makeItem({ id: "ID-2", danish: "hund", english: "dog" }),
        ];
        const result = await store.insertBatch(items);
        assert.equal(result.inserted, 1);
        assert.equal(result.alreadyPresent, 1);
        assert.equal(result.items.find(i => i.id === "ID-1")!.status, "duplicate_id");
        assert.equal(result.items.find(i => i.id === "ID-2")!.status, "created");
    });

    it("duplicate_canonical are ignored!", async () => {
        const existing = makeItem({ id: "A1-01-hus", danish: "hus" }).toBSON();
        const col = makeMockCollection([existing]);
        const store = new VocabularyItemStore(makeMockDb(col));
        const items = [makeItem({ id: "A1-02-hus", danish: "hus" })];
        const result = await store.insertBatch(items);
        assert.equal(result.alreadyPresent, 0);
        assert.equal(result.inserted, 1);
        assert.isTrue(result.items.every(i => i.status === "created"));
    });

    it("returns empty result for an empty input array", async () => {
        const col = makeMockCollection();
        const store = new VocabularyItemStore(makeMockDb(col));
        const result = await store.insertBatch([]);
        assert.equal(result.inserted, 0);
        assert.equal(result.alreadyPresent, 0);
        assert.deepEqual(result.items, []);
    });

});

// -------------------------------------------------------------------------
// findById
// -------------------------------------------------------------------------

describe("VocabularyItemStore.findById", () => {

    it("returns the item when it exists", async () => {
        const existing = makeItem().toBSON();
        const col = makeMockCollection([existing]);
        const store = new VocabularyItemStore(makeMockDb(col));
        const found = await store.findById("A1-01-n-hus");
        assert.isNotNull(found);
        assert.equal(found!.id, "A1-01-n-hus");
    });

    it("returns null when the item does not exist", async () => {
        const col = makeMockCollection();
        const store = new VocabularyItemStore(makeMockDb(col));
        const found = await store.findById("nonexistent");
        assert.isNull(found);
    });

});

// -------------------------------------------------------------------------
// findByIds
// -------------------------------------------------------------------------

describe("VocabularyItemStore.findByIds", () => {

    it("returns all found items and ignores missing ids", async () => {
        const docs = [
            makeItem({ id: "ID-1", danish: "hus" }).toBSON(),
            makeItem({ id: "ID-2", danish: "hund", english: "dog" }).toBSON(),
        ];
        const col = makeMockCollection(docs);
        const store = new VocabularyItemStore(makeMockDb(col));
        const found = await store.findByIds(["ID-1", "ID-2", "MISSING"]);
        assert.equal(found.length, 2);
        assert.includeMembers(found.map(i => i.id), ["ID-1", "ID-2"]);
    });

    it("returns empty array when none of the ids exist", async () => {
        const col = makeMockCollection();
        const store = new VocabularyItemStore(makeMockDb(col));
        const found = await store.findByIds(["NOPE"]);
        assert.deepEqual(found, []);
    });

});

// -------------------------------------------------------------------------
// list
// -------------------------------------------------------------------------

describe("VocabularyItemStore.list", () => {

    it("returns all items when no cefrLevel filter is given", async () => {
        const docs = [
            makeItem({ id: "ID-1", danish: "hus", cefrLevel: "A1" }).toBSON(),
            makeItem({ id: "ID-2", danish: "hund", english: "dog", cefrLevel: "A2" }).toBSON(),
        ];
        const col = makeMockCollection(docs);
        const store = new VocabularyItemStore(makeMockDb(col));
        const items = await store.list();
        assert.equal(items.length, 2);
    });

    it("returns only items matching the cefrLevel filter", async () => {
        const docs = [
            makeItem({ id: "ID-1", danish: "hus", cefrLevel: "A1" }).toBSON(),
            makeItem({ id: "ID-2", danish: "hund", english: "dog", cefrLevel: "A2" }).toBSON(),
        ];
        const col = makeMockCollection(docs);
        const store = new VocabularyItemStore(makeMockDb(col));
        const items = await store.list("A1");
        assert.equal(items.length, 1);
        assert.equal(items[0].id, "ID-1");
    });

});
