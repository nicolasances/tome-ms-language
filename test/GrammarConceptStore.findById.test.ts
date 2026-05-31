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
    };
}

function makeMockDb(collection: any) {
    return { collection: () => collection } as any;
}

describe("GrammarConceptStore.findById", () => {

    it("returns the concept when it exists", async () => {

        const existing = makeConcept().toBSON();
        const col = makeMockCollection([existing]);
        const store = new GrammarConceptStore(makeMockDb(col));

        const found = await store.findById("A1-01-g-present-tense-6604");

        assert.isNotNull(found);
        assert.equal(found!.id, "A1-01-g-present-tense-6604");
        assert.equal(found!.name, "Present Tense");
    });

    it("returns null when the id does not exist", async () => {

        const col = makeMockCollection();
        const store = new GrammarConceptStore(makeMockDb(col));

        const found = await store.findById("nonexistent");

        assert.isNull(found);
    });

});
