import { assert } from "chai";
import { Module } from "../src/model/Module";
import { ModuleStore } from "../src/store/ModuleStore";

function makeModule(overrides: Partial<ConstructorParameters<typeof Module>[0]> = {}): Module {

    return new Module({
        id: "danish-A1-01",
        title: "Greetings",
        theme: "Daily greetings",
        communicationGoal: "Greet and introduce yourself",
        cefrLevel: "A1",
        vocabularyItemIds: [],
        grammarConceptIds: [],
        isUserGenerated: false,
        ...overrides,
    });
}

function makeMockCollection(docs: any[]) {

    return {
        findOne: async () => null,
        find: (filter: any) => ({
            sort: (_s: any) => ({
                toArray: async () => {
                    return docs.filter(doc => {
                        if (filter.cefrLevel !== undefined && doc.cefrLevel !== filter.cefrLevel) return false;
                        if (filter.isUserGenerated !== undefined && doc.isUserGenerated !== filter.isUserGenerated) return false;
                        return true;
                    });
                },
            }),
        }),
    };
}

function makeMockDb(collection: any) {
    return { collection: () => collection } as any;
}

const seedDocs = [
    makeModule({ id: "danish-A1-01", cefrLevel: "A1", isUserGenerated: false }).toBSON(),
    makeModule({ id: "danish-A1-02", cefrLevel: "A1", isUserGenerated: false }).toBSON(),
    makeModule({ id: "danish-B1-01", cefrLevel: "B1", isUserGenerated: false }).toBSON(),
    makeModule({ id: "user-gen-01", cefrLevel: "A1", isUserGenerated: true }).toBSON(),
];

describe("ModuleStore.list", () => {

    it("returns all modules when no filters are given", async () => {

        const col = makeMockCollection(seedDocs);
        const store = new ModuleStore(makeMockDb(col));

        const result = await store.list();

        assert.equal(result.length, 4);
    });

    it("filters by cefrLevel correctly", async () => {

        const col = makeMockCollection(seedDocs);
        const store = new ModuleStore(makeMockDb(col));

        const result = await store.list("A1");

        assert.equal(result.length, 3);
        result.forEach(m => assert.equal(m.cefrLevel, "A1"));
    });

    it("filters by isUserGenerated correctly", async () => {

        const col = makeMockCollection(seedDocs);
        const store = new ModuleStore(makeMockDb(col));

        const result = await store.list(undefined, false);

        assert.equal(result.length, 3);
        result.forEach(m => assert.equal(m.isUserGenerated, false));
    });

    it("applies both cefrLevel and isUserGenerated filters together", async () => {

        const col = makeMockCollection(seedDocs);
        const store = new ModuleStore(makeMockDb(col));

        const result = await store.list("A1", false);

        assert.equal(result.length, 2);
        result.forEach(m => {
            assert.equal(m.cefrLevel, "A1");
            assert.equal(m.isUserGenerated, false);
        });
    });

});
