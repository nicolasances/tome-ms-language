import { assert } from "chai";
import { UserModuleProgress, ModuleTestAttempt } from "../src/model/UserModuleProgress";
import { UserModuleProgressStore } from "../src/store/UserModuleProgressStore";

function makeProgress(overrides: Partial<ConstructorParameters<typeof UserModuleProgress>[0]> = {}): UserModuleProgress {
    return new UserModuleProgress({
        userId: "user-1",
        moduleId: "mod-1",
        status: "available",
        startedAt: null,
        completedAt: null,
        testAttempts: [],
        ...overrides,
    });
}

function makeMockCollection(docs: any[] = []) {
    return {
        findOne: async (filter: any) =>
            docs.find(d => d.userId === filter.userId && d.moduleId === filter.moduleId) ?? null,
        find: (filter: any) => ({
            toArray: async () => docs.filter(d => d.userId === filter.userId),
        }),
        replaceOne: async (_filter: any, doc: any, _opts: any) => {
            const idx = docs.findIndex(d => d.userId === doc.userId && d.moduleId === doc.moduleId);
            if (idx >= 0) docs[idx] = doc; else docs.push(doc);
            return {};
        },
    };
}

function makeMockDb(collection: any) {
    return { collection: () => collection } as any;
}

describe("UserModuleProgressStore.transitionStatus", () => {

    it("creates a new in_progress record with startedAt set when no record exists", async () => {
        const docs: any[] = [];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.transitionStatus("user-1", "mod-1", "in_progress");

        assert.equal(result.status, "in_progress");
        assert.equal(result.moduleId, "mod-1");
        assert.isNotNull(result.startedAt);
        assert.isNull(result.completedAt);
        assert.equal(docs.length, 1);
    });

    it("creates a new completed record with completedAt set when no record exists", async () => {
        const docs: any[] = [];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.transitionStatus("user-1", "mod-1", "completed");

        assert.isNotNull(result.completedAt);
    });

    it("does not overwrite startedAt when transitioning to in_progress again", async () => {
        const existingStartedAt = "2026-05-01T08:00:00.000Z";
        const docs = [makeProgress({ status: "in_progress", startedAt: existingStartedAt }).toBSON()];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.transitionStatus("user-1", "mod-1", "in_progress");

        assert.equal(result.startedAt, existingStartedAt);
    });

    it("preserves testAttempts from the existing record during a status transition", async () => {
        const attempt = new ModuleTestAttempt({ id: "att-1", score: 75, passed: false, takenAt: "2026-06-01T10:00:00.000Z" });
        const docs = [makeProgress({ status: "in_progress", testAttempts: [attempt] }).toBSON()];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.transitionStatus("user-1", "mod-1", "completed");

        assert.equal(result.testAttempts.length, 1);
        assert.equal(result.testAttempts[0].id, "att-1");
    });

    it("preserves vocabularyItemsPracticed from the existing record during a status transition", async () => {
        const docs = [makeProgress({ status: "in_progress", vocabularyItemsPracticed: ["v-1", "v-2"] }).toBSON()];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.transitionStatus("user-1", "mod-1", "completed");

        assert.deepEqual(result.vocabularyItemsPracticed, ["v-1", "v-2"]);
    });

    it("sets practiceCompletedAt when provided and none exists yet", async () => {
        const docs = [makeProgress({ status: "in_progress" }).toBSON()];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.transitionStatus("user-1", "mod-1", "in_progress", "2026-06-02T09:00:00.000Z");

        assert.equal(result.practiceCompletedAt, "2026-06-02T09:00:00.000Z");
    });

    it("does not overwrite an existing practiceCompletedAt (idempotent)", async () => {
        const docs = [makeProgress({ status: "in_progress", practiceCompletedAt: "2026-06-01T08:00:00.000Z" }).toBSON()];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.transitionStatus("user-1", "mod-1", "completed", "2026-06-09T10:00:00.000Z");

        assert.equal(result.practiceCompletedAt, "2026-06-01T08:00:00.000Z");
    });

    it("returns the updated record persisted via replaceOne", async () => {
        const docs: any[] = [];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        await store.transitionStatus("user-1", "mod-1", "in_progress");

        assert.equal(docs.length, 1);
        assert.equal(docs[0].userId, "user-1");
        assert.equal(docs[0].moduleId, "mod-1");
        assert.equal(docs[0].status, "in_progress");
    });
});
