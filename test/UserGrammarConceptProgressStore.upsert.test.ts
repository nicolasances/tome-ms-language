import { assert } from "chai";
import { UserGrammarConceptProgress } from "../src/model/UserGrammarConceptProgress";
import { UserGrammarConceptProgressStore } from "../src/store/UserGrammarConceptProgressStore";

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

describe("UserGrammarConceptProgressStore.upsert", () => {

    it("creates a new record when none exists", async () => {
        const docs: any[] = [];
        const store = new UserGrammarConceptProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const progress = makeProgress({ masteryScore: 0.3 });
        const result = await store.upsert(progress);

        assert.equal(result.userId, "user-1");
        assert.equal(result.masteryScore, 0.3);
        assert.equal(docs.length, 1);
    });

    it("replaces the existing record for the same user+concept pair", async () => {
        const docs = [makeProgress({ masteryScore: 0.3 }).toBSON()];
        const store = new UserGrammarConceptProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        await store.upsert(makeProgress({ masteryScore: 0.7 }));

        assert.equal(docs.length, 1);
        assert.equal(docs[0].masteryScore, 0.7);
    });
});
