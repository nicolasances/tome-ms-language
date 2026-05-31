import { assert } from "chai";
import { GrammarConcept } from "../src/model/GrammarConcept";
import { GrammarConceptStore } from "../src/store/GrammarConceptStore";

function makeConcept(overrides: Partial<ConstructorParameters<typeof GrammarConcept>[0]> = {}): GrammarConcept {
    return new GrammarConcept({
        id: "A1-01-g-present-tense-6604",
        name: "Present Tense",
        category: "tenses",
        cefrLevelIntroduced: "A1",
        explanation: "The present tense describes current actions.",
        examples: [{ danish: "Jeg spiser.", english: "I eat." }],
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

describe("GrammarConceptStore.insertOne", () => {

    it("inserts a new concept and returns status created", async () => {

        const col = makeMockCollection();
        const store = new GrammarConceptStore(makeMockDb(col));

        const result = await store.insertOne(makeConcept());

        assert.equal(result.status, "created");
        assert.equal(result.concept.id, "A1-01-g-present-tense-6604");
    });

    it("returns duplicate_id when a concept with the same id already exists", async () => {

        const existing = makeConcept().toBSON();
        const col = makeMockCollection([existing]);
        const store = new GrammarConceptStore(makeMockDb(col));

        const result = await store.insertOne(makeConcept({ name: "Other Name" }));

        assert.equal(result.status, "duplicate_id");
    });

});
