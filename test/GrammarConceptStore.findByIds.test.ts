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
            const results = filter.id?.$in
                ? store.filter(doc => (filter.id.$in as string[]).includes(doc.id))
                : [...store];
            return { toArray: async () => results };
        },
    };
}

function makeMockDb(collection: any) {
    return { collection: () => collection } as any;
}

describe("GrammarConceptStore.findByIds", () => {

    it("returns all found concepts and ignores missing ids", async () => {

        const docs = [
            makeConcept({ id: "ID-1", name: "Present Tense" }).toBSON(),
            makeConcept({ id: "ID-2", name: "Past Tense" }).toBSON(),
        ];
        const col = makeMockCollection(docs);
        const store = new GrammarConceptStore(makeMockDb(col));

        const found = await store.findByIds(["ID-1", "ID-2", "MISSING"]);

        assert.equal(found.length, 2);
        assert.includeMembers(found.map(c => c.id), ["ID-1", "ID-2"]);
    });

    it("returns empty array when none of the ids exist", async () => {

        const col = makeMockCollection();
        const store = new GrammarConceptStore(makeMockDb(col));

        const found = await store.findByIds(["NOPE"]);

        assert.deepEqual(found, []);
    });

});
