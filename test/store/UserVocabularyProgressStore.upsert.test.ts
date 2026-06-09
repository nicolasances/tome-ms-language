import { assert } from "chai";
import { UserVocabularyProgress } from "../../src/model/UserVocabularyProgress";
import { UserVocabularyProgressStore } from "../../src/store/UserVocabularyProgressStore";

function makeProgress(overrides: Partial<ConstructorParameters<typeof UserVocabularyProgress>[0]> = {}): UserVocabularyProgress {
    return new UserVocabularyProgress({
        userId: "user-1",
        vocabularyItemId: "A1-01-v-hund-1234",
        masteryScore: 0.5,
        lastReviewed: null,
        exerciseHistory: [],
        ...overrides,
    });
}

function makeMockCollection(docs: any[] = []) {
    return {
        findOne: async (filter: any) =>
            docs.find(d => d.userId === filter.userId && d.vocabularyItemId === filter.vocabularyItemId) ?? null,
        replaceOne: async (_filter: any, doc: any, _opts: any) => {
            const idx = docs.findIndex(d => d.userId === doc.userId && d.vocabularyItemId === doc.vocabularyItemId);
            if (idx >= 0) docs[idx] = doc; else docs.push(doc);
            return {};
        },
    };
}

function makeMockDb(collection: any) {
    return { collection: () => collection } as any;
}

describe("UserVocabularyProgressStore.upsert", () => {

    it("creates a new record when none exists", async () => {
        const docs: any[] = [];
        const store = new UserVocabularyProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const progress = makeProgress({ masteryScore: 0.3 });
        const result = await store.upsert(progress);

        assert.equal(result.userId, "user-1");
        assert.equal(result.masteryScore, 0.3);
        assert.equal(docs.length, 1);
    });

    it("replaces the existing record for the same user+item pair", async () => {
        const docs = [makeProgress({ masteryScore: 0.3 }).toBSON()];
        const store = new UserVocabularyProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        await store.upsert(makeProgress({ masteryScore: 0.7 }));

        assert.equal(docs.length, 1);
        assert.equal(docs[0].masteryScore, 0.7);
    });
});
