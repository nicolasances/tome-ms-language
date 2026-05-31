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
        find: (filter: any) => {
            let results = [...store];

            if (filter.cefrLevelIntroduced) results = results.filter(doc => doc.cefrLevelIntroduced === filter.cefrLevelIntroduced);
            if (filter.category) results = results.filter(doc => doc.category === filter.category);

            return {
                sort: () => ({ toArray: async () => [...results].sort((a, b) => a.name.localeCompare(b.name)) }),
            };
        },
    };
}

function makeMockDb(collection: any) {
    return { collection: () => collection } as any;
}

describe("GrammarConceptStore.list", () => {

    it("returns all concepts when no filters are given", async () => {

        const docs = [
            makeConcept({ id: "ID-1", name: "Present Tense", cefrLevelIntroduced: "A1" }).toBSON(),
            makeConcept({ id: "ID-2", name: "Past Tense", cefrLevelIntroduced: "A2", category: "tenses" }).toBSON(),
        ];
        const col = makeMockCollection(docs);
        const store = new GrammarConceptStore(makeMockDb(col));

        const items = await store.list();

        assert.equal(items.length, 2);
    });

    it("returns only concepts with cefrLevelIntroduced exactly matching the filter", async () => {

        const docs = [
            makeConcept({ id: "ID-1", name: "Present Tense", cefrLevelIntroduced: "A1" }).toBSON(),
            makeConcept({ id: "ID-2", name: "Past Tense", cefrLevelIntroduced: "A2", category: "tenses" }).toBSON(),
            makeConcept({ id: "ID-3", name: "Modal Verbs", cefrLevelIntroduced: "B1", category: "verbs" }).toBSON(),
        ];
        const col = makeMockCollection(docs);
        const store = new GrammarConceptStore(makeMockDb(col));

        const items = await store.list("A2");

        assert.equal(items.length, 1);
        assert.equal(items[0].id, "ID-2");
    });

    it("returns only concepts matching the category filter", async () => {

        const docs = [
            makeConcept({ id: "ID-1", name: "Present Tense", category: "tenses" }).toBSON(),
            makeConcept({ id: "ID-2", name: "Inversion", category: "sentence_structure" }).toBSON(),
        ];
        const col = makeMockCollection(docs);
        const store = new GrammarConceptStore(makeMockDb(col));

        const items = await store.list(undefined, "sentence_structure");

        assert.equal(items.length, 1);
        assert.equal(items[0].id, "ID-2");
    });

    it("combines cefrLevelIntroduced and category filters", async () => {

        const docs = [
            makeConcept({ id: "ID-1", name: "Present Tense", cefrLevelIntroduced: "A1", category: "tenses" }).toBSON(),
            makeConcept({ id: "ID-2", name: "Inversion", cefrLevelIntroduced: "A1", category: "sentence_structure" }).toBSON(),
            makeConcept({ id: "ID-3", name: "Past Tense", cefrLevelIntroduced: "A2", category: "tenses" }).toBSON(),
        ];
        const col = makeMockCollection(docs);
        const store = new GrammarConceptStore(makeMockDb(col));

        const items = await store.list("A1", "tenses");

        assert.equal(items.length, 1);
        assert.equal(items[0].id, "ID-1");
    });

});
