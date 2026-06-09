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
        find: (filter: any) => ({
            toArray: async () => docs.filter(doc => {
                if (doc.userId !== filter.userId) return false;
                if (filter.vocabularyItemId?.$in && !filter.vocabularyItemId.$in.includes(doc.vocabularyItemId)) return false;
                return true;
            }),
        }),
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

describe("UserVocabularyProgressStore.findByUserAndItem", () => {

    it("returns the progress record when it exists", async () => {
        const doc = makeProgress({ masteryScore: 0.62 }).toBSON();
        const store = new UserVocabularyProgressStore({ db: makeMockDb(makeMockCollection([doc])), config: {} as any });

        const result = await store.findByUserAndItem("user-1", "A1-01-v-hund-1234");

        assert.isNotNull(result);
        assert.equal(result!.userId, "user-1");
        assert.equal(result!.vocabularyItemId, "A1-01-v-hund-1234");
        assert.equal(result!.masteryScore, 0.62);
    });

    it("returns null when no record exists for the user+item pair", async () => {
        const store = new UserVocabularyProgressStore({ db: makeMockDb(makeMockCollection([])), config: {} as any });

        const result = await store.findByUserAndItem("user-1", "A1-01-v-hund-1234");

        assert.isNull(result);
    });
});

describe("UserVocabularyProgressStore.listByUser", () => {

    const seedDocs = [
        makeProgress({ vocabularyItemId: "item-1", masteryScore: 0.9 }).toBSON(),
        makeProgress({ vocabularyItemId: "item-2", masteryScore: 0.4 }).toBSON(),
        makeProgress({ vocabularyItemId: "item-3", masteryScore: 0.1 }).toBSON(),
        makeProgress({ userId: "user-2", vocabularyItemId: "item-1", masteryScore: 0.5 }).toBSON(),
    ];

    it("returns all progress records for the user when no item id filter is given", async () => {
        const store = new UserVocabularyProgressStore({ db: makeMockDb(makeMockCollection([...seedDocs])), config: {} as any });

        const result = await store.listByUser("user-1");

        assert.equal(result.length, 3);
        result.forEach(r => assert.equal(r.userId, "user-1"));
    });

    it("returns only records matching the vocabularyItemIds filter (bulk read for F08)", async () => {
        const store = new UserVocabularyProgressStore({ db: makeMockDb(makeMockCollection([...seedDocs])), config: {} as any });

        const result = await store.listByUser("user-1", ["item-1", "item-2"]);

        assert.equal(result.length, 2);
        const ids = result.map(r => r.vocabularyItemId);
        assert.include(ids, "item-1");
        assert.include(ids, "item-2");
    });

    it("does not return records belonging to other users", async () => {
        const store = new UserVocabularyProgressStore({ db: makeMockDb(makeMockCollection([...seedDocs])), config: {} as any });

        const result = await store.listByUser("user-1");

        result.forEach(r => assert.equal(r.userId, "user-1"));
    });

    it("returns an empty array when the user has no progress records", async () => {
        const store = new UserVocabularyProgressStore({ db: makeMockDb(makeMockCollection([...seedDocs])), config: {} as any });

        const result = await store.listByUser("user-99");

        assert.deepEqual(result, []);
    });
});
