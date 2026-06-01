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
        ...overrides,
    });
}

function makeMockCollection(docs: any[] = []) {

    const store = [...docs];

    return {
        findOne: async (filter: any) => {
            return store.find(doc => {
                if (filter.id !== undefined && doc.id !== filter.id) return false;
                return true;
            }) ?? null;
        },
        insertOne: async (doc: any) => { store.push(doc); return { insertedId: "mock" }; },
    };
}

function makeMockDb(collection: any) {
    return { collection: () => collection } as any;
}

describe("ModuleStore.insertOne", () => {

    it("inserts a new module and returns status created", async () => {

        const col = makeMockCollection();
        const store = new ModuleStore(makeMockDb(col));

        const result = await store.insertOne(makeModule());

        assert.equal(result.status, "created");
        assert.equal(result.module.id, "danish-A1-01");
    });

    it("returns duplicate_id when a module with the same id already exists", async () => {

        const existing = makeModule().toBSON();
        const col = makeMockCollection([existing]);
        const store = new ModuleStore(makeMockDb(col));

        const result = await store.insertOne(makeModule({ title: "Other Title" }));

        assert.equal(result.status, "duplicate_id");
    });

});
