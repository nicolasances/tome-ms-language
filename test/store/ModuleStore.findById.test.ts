import { assert } from "chai";
import { Module } from "../../src/model/Module";
import { ModuleStore } from "../../src/store/ModuleStore";

function makeModule(overrides: Partial<ConstructorParameters<typeof Module>[0]> = {}): Module {

    return new Module({
        id: "danish-A1-01",
        title: "Greetings",
        theme: "Daily greetings",
        communicationGoal: "Greet and introduce yourself",
        cefrLevel: "A1",
        vocabularyItemIds: [],
        grammarConceptIds: [],
        ...overrides,
    });
}

function makeMockCollection(docs: any[] = []) {

    return {
        findOne: async (filter: any) => {
            return docs.find(doc => {
                if (filter.id !== undefined && doc.id !== filter.id) return false;
                return true;
            }) ?? null;
        },
        find: (_filter: any) => ({
            sort: (_s: any) => ({ toArray: async () => [] }),
        }),
    };
}

function makeMockDb(collection: any) {
    return { collection: () => collection } as any;
}

describe("ModuleStore.findById", () => {

    it("returns the module when it exists", async () => {

        const existing = makeModule().toBSON();
        const col = makeMockCollection([existing]);
        const store = new ModuleStore(makeMockDb(col));

        const result = await store.findById("danish-A1-01");

        assert.isNotNull(result);
        assert.equal(result!.id, "danish-A1-01");
        assert.equal(result!.title, "Greetings");
    });

    it("returns null when no module matches the id", async () => {

        const col = makeMockCollection([]);
        const store = new ModuleStore(makeMockDb(col));

        const result = await store.findById("does-not-exist");

        assert.isNull(result);
    });

});
