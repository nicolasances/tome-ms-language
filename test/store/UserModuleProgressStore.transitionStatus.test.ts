import { assert } from "chai";
import { UserModuleProgress, RungCoverage, TestAttemptRecord } from "../../src/model/UserModuleProgress";
import { UserModuleProgressStore } from "../../src/store/UserModuleProgressStore";

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
        const attempt = new TestAttemptRecord({ id: "att-1", score: 75, passed: false, takenAt: "2026-06-01T10:00:00.000Z" });
        const docs = [makeProgress({ status: "in_progress", testAttempts: [attempt] }).toBSON()];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.transitionStatus("user-1", "mod-1", "completed");

        assert.equal(result.testAttempts.length, 1);
        assert.equal(result.testAttempts[0].id, "att-1");
    });

    it("preserves rungCoverage from the existing record during a status transition", async () => {
        const docs = [makeProgress({ status: "in_progress", rungCoverage: [new RungCoverage({ rung: 1, itemIds: ["v-1", "v-2"], completedAt: "2026-06-02T08:00:00.000Z" })] }).toBSON()];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.transitionStatus("user-1", "mod-1", "completed");

        assert.equal(result.rungCoverage.length, 1);
        assert.deepEqual(result.rungCoverage[0].itemIds, ["v-1", "v-2"]);
        assert.equal(result.rungCoverage[0].completedAt, "2026-06-02T08:00:00.000Z");
    });

    it("preserves currentRung from the existing record during a status transition", async () => {
        const docs = [makeProgress({ status: "in_progress", currentRung: 3 }).toBSON()];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.transitionStatus("user-1", "mod-1", "completed");

        assert.equal(result.currentRung, 3);
    });

    it("starts a brand-new record at the first rung with no coverage", async () => {
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection([])), config: {} as any });

        const result = await store.transitionStatus("user-1", "mod-1", "in_progress");

        assert.equal(result.currentRung, 1);
        assert.deepEqual(result.rungCoverage, []);
    });

    it("does not downgrade a completed module back to in_progress", async () => {

        // Re-entering a passed module via "Keep practising" starts a session, which transitions to
        // in_progress. That must not un-complete the module: F21 gates the level test on every
        // module at the level being completed.
        const docs = [makeProgress({ status: "completed", completedAt: "2026-06-05T10:00:00.000Z" }).toBSON()];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.transitionStatus("user-1", "mod-1", "in_progress");

        assert.equal(result.status, "completed");
        assert.equal(result.completedAt, "2026-06-05T10:00:00.000Z");
    });

    it("still records rung progress written while re-practising a completed module", async () => {

        const docs = [makeProgress({ status: "completed", completedAt: "2026-06-05T10:00:00.000Z", currentRung: 3, rungCoverage: [new RungCoverage({ rung: 1, itemIds: ["v-1"], completedAt: "2026-06-01T09:00:00.000Z" })] }).toBSON()];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.transitionStatus("user-1", "mod-1", "in_progress");

        assert.equal(result.status, "completed");
        assert.equal(result.currentRung, 3);
        assert.equal(result.rungCoverage.length, 1);
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

    it("preserves passNumber from the existing record across a status transition (F25)", async () => {

        // A re-practised module (passNumber 2) starting its new pass's first session must not have
        // its pass stamp silently reset to 1 — every session/attempt created afterwards, and the
        // score computed on completion, would otherwise be scoped to the wrong pass.
        const docs = [makeProgress({ status: "available", passNumber: 2 }).toBSON()];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.transitionStatus("user-1", "mod-1", "in_progress");

        assert.equal(result.passNumber, 2);
    });

    it("defaults passNumber to 1 for a brand-new record", async () => {
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection([])), config: {} as any });

        const result = await store.transitionStatus("user-1", "mod-1", "in_progress");

        assert.equal(result.passNumber, 1);
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
