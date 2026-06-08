import { assert } from "chai";
import { UserModuleProgress } from "../src/model/UserModuleProgress";
import { UserModuleProgressStore } from "../src/store/UserModuleProgressStore";

function makeProgress(overrides: Partial<ConstructorParameters<typeof UserModuleProgress>[0]> = {}): UserModuleProgress {
    return new UserModuleProgress({
        userId: "user-1", moduleId: "mod-1", status: "in_progress",
        startedAt: "2026-06-01T09:00:00.000Z", completedAt: null, testAttempts: [],
        ...overrides,
    });
}

/**
 * Mock collection simulating $addToSet with $each (set-union, no duplicates).
 */
function makeMockCollection(docs: any[] = []) {
    return {
        findOne: async (filter: any) =>
            docs.find(d => d.userId === filter.userId && d.moduleId === filter.moduleId) ?? null,
        updateOne: async (filter: any, update: any) => {
            const doc = docs.find(d => d.userId === filter.userId && d.moduleId === filter.moduleId);
            if (!doc) return { matchedCount: 0 };
            doc.vocabularyItemsPracticed = doc.vocabularyItemsPracticed ?? [];
            const toAdd = update.$addToSet.vocabularyItemsPracticed.$each as string[];
            for (const id of toAdd) if (!doc.vocabularyItemsPracticed.includes(id)) doc.vocabularyItemsPracticed.push(id);
            return { matchedCount: 1 };
        },
    };
}

function makeMockDb(collection: any) {
    return { collection: () => collection } as any;
}

describe("UserModuleProgressStore.appendPracticedVocabulary", () => {

    it("adds the vocabulary ids to vocabularyItemsPracticed and returns the updated record", async () => {
        const docs = [makeProgress().toBSON()];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.appendPracticedVocabulary("user-1", "mod-1", ["v-1", "v-2"]);

        assert.isNotNull(result);
        assert.deepEqual(result!.vocabularyItemsPracticed, ["v-1", "v-2"]);
    });

    it("does not create duplicates when an id was already practiced (set-union)", async () => {
        const docs = [makeProgress({ vocabularyItemsPracticed: ["v-1"] }).toBSON()];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.appendPracticedVocabulary("user-1", "mod-1", ["v-1", "v-2"]);

        assert.deepEqual(result!.vocabularyItemsPracticed, ["v-1", "v-2"]);
    });

    it("returns null when no progress record exists", async () => {
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection([])), config: {} as any });

        const result = await store.appendPracticedVocabulary("user-1", "mod-1", ["v-1"]);

        assert.isNull(result);
    });
});
