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
        insertMany: async (docs_: any[]) => { docs_.forEach(d => store.push(d)); return {}; },
    };
}

function makeMockDb(collection: any) {
    return { collection: () => collection } as any;
}

describe("GrammarConceptStore.insertBatch", () => {

    it("inserts all new concepts and reports correct summary", async () => {

        const col = makeMockCollection();
        const store = new GrammarConceptStore(makeMockDb(col));
        const items = [
            makeConcept({ id: "ID-1", name: "Present Tense" }),
            makeConcept({ id: "ID-2", name: "Past Tense" }),
        ];

        const result = await store.insertBatch(items);

        assert.equal(result.inserted, 2);
        assert.equal(result.alreadyPresent, 0);
        assert.isTrue(result.items.every(i => i.status === "created"));
    });

    it("skips duplicate by id and returns correct summary", async () => {

        const existing = makeConcept({ id: "ID-1", name: "Present Tense" }).toBSON();
        const col = makeMockCollection([existing]);
        const store = new GrammarConceptStore(makeMockDb(col));
        const items = [
            makeConcept({ id: "ID-1", name: "Present Tense" }),
            makeConcept({ id: "ID-2", name: "Past Tense" }),
        ];

        const result = await store.insertBatch(items);

        assert.equal(result.inserted, 1);
        assert.equal(result.alreadyPresent, 1);
        assert.equal(result.items.find(i => i.id === "ID-1")!.status, "duplicate_id");
        assert.equal(result.items.find(i => i.id === "ID-2")!.status, "created");
    });

    it("returns empty result for an empty input array", async () => {

        const col = makeMockCollection();
        const store = new GrammarConceptStore(makeMockDb(col));

        const result = await store.insertBatch([]);

        assert.equal(result.inserted, 0);
        assert.equal(result.alreadyPresent, 0);
        assert.deepEqual(result.items, []);
    });

});
