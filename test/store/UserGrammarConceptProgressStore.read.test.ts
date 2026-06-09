import { assert } from "chai";
import { UserGrammarConceptProgress } from "../../src/model/UserGrammarConceptProgress";
import { UserGrammarConceptProgressStore } from "../../src/store/UserGrammarConceptProgressStore";

function makeProgress(overrides: Partial<ConstructorParameters<typeof UserGrammarConceptProgress>[0]> = {}): UserGrammarConceptProgress {
    return new UserGrammarConceptProgress({
        userId: "user-1",
        grammarConceptId: "gc-inversion",
        masteryScore: 0.5,
        lastReviewed: null,
        exerciseHistory: [],
        ...overrides,
    });
}

function makeMockCollection(docs: any[] = []) {
    return {
        findOne: async (filter: any) =>
            docs.find(d => d.userId === filter.userId && d.grammarConceptId === filter.grammarConceptId) ?? null,
        find: (filter: any) => ({
            toArray: async () => docs.filter(doc => {
                if (doc.userId !== filter.userId) return false;
                if (filter.grammarConceptId?.$in && !filter.grammarConceptId.$in.includes(doc.grammarConceptId)) return false;
                return true;
            }),
        }),
        replaceOne: async (_filter: any, doc: any, _opts: any) => {
            const idx = docs.findIndex(d => d.userId === doc.userId && d.grammarConceptId === doc.grammarConceptId);
            if (idx >= 0) docs[idx] = doc; else docs.push(doc);
            return {};
        },
    };
}

function makeMockDb(collection: any) {
    return { collection: () => collection } as any;
}

describe("UserGrammarConceptProgressStore.findByUserAndConcept", () => {

    it("returns the progress record when it exists", async () => {
        const doc = makeProgress({ masteryScore: 0.62 }).toBSON();
        const store = new UserGrammarConceptProgressStore({ db: makeMockDb(makeMockCollection([doc])), config: {} as any });

        const result = await store.findByUserAndConcept("user-1", "gc-inversion");

        assert.isNotNull(result);
        assert.equal(result!.userId, "user-1");
        assert.equal(result!.grammarConceptId, "gc-inversion");
        assert.equal(result!.masteryScore, 0.62);
    });

    it("returns null when no record exists for the user+concept pair", async () => {
        const store = new UserGrammarConceptProgressStore({ db: makeMockDb(makeMockCollection([])), config: {} as any });

        const result = await store.findByUserAndConcept("user-1", "gc-inversion");

        assert.isNull(result);
    });
});

describe("UserGrammarConceptProgressStore.listByUser", () => {

    const seedDocs = [
        makeProgress({ grammarConceptId: "gc-1", masteryScore: 0.9 }).toBSON(),
        makeProgress({ grammarConceptId: "gc-2", masteryScore: 0.4 }).toBSON(),
        makeProgress({ grammarConceptId: "gc-3", masteryScore: 0.1 }).toBSON(),
        makeProgress({ userId: "user-2", grammarConceptId: "gc-1", masteryScore: 0.5 }).toBSON(),
    ];

    it("returns all progress records for the user when no concept id filter is given", async () => {
        const store = new UserGrammarConceptProgressStore({ db: makeMockDb(makeMockCollection([...seedDocs])), config: {} as any });

        const result = await store.listByUser("user-1");

        assert.equal(result.length, 3);
        result.forEach(r => assert.equal(r.userId, "user-1"));
    });

    it("returns only records matching the grammarConceptIds filter (bulk read for F08)", async () => {
        const store = new UserGrammarConceptProgressStore({ db: makeMockDb(makeMockCollection([...seedDocs])), config: {} as any });

        const result = await store.listByUser("user-1", ["gc-1", "gc-2"]);

        assert.equal(result.length, 2);
        const ids = result.map(r => r.grammarConceptId);
        assert.include(ids, "gc-1");
        assert.include(ids, "gc-2");
    });

    it("does not return records belonging to other users", async () => {
        const store = new UserGrammarConceptProgressStore({ db: makeMockDb(makeMockCollection([...seedDocs])), config: {} as any });

        const result = await store.listByUser("user-1");

        result.forEach(r => assert.equal(r.userId, "user-1"));
    });

    it("returns an empty array when the user has no progress records", async () => {
        const store = new UserGrammarConceptProgressStore({ db: makeMockDb(makeMockCollection([...seedDocs])), config: {} as any });

        const result = await store.listByUser("user-99");

        assert.deepEqual(result, []);
    });
});
