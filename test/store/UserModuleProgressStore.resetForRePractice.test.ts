import { assert } from "chai";
import { ModuleProficiency, RungCoverage, TestAttemptRecord, UserModuleProgress } from "../../src/model/UserModuleProgress";
import { UserModuleProgressStore } from "../../src/store/UserModuleProgressStore";

function makeCompletedProgress(overrides: Partial<ConstructorParameters<typeof UserModuleProgress>[0]> = {}): UserModuleProgress {
    return new UserModuleProgress({
        userId: "user-1",
        moduleId: "mod-1",
        status: "completed",
        startedAt: "2026-06-01T09:00:00.000Z",
        completedAt: "2026-06-05T10:00:00.000Z",
        currentRung: 3,
        rungCoverage: [new RungCoverage({ rung: 1, itemIds: ["v-1"], completedAt: "2026-06-02T08:00:00.000Z" })],
        practiceCompletedAt: "2026-06-04T09:00:00.000Z",
        testAttempts: [new TestAttemptRecord({ id: "att-1", score: 85, passed: true, takenAt: "2026-06-05T09:00:00.000Z" })],
        proficiency: new ModuleProficiency({ score: 69.5, testScore: 57.1, practiceScore: 88, basis: "full", computedAt: "2026-06-05T10:00:00.000Z", version: 1 }),
        ...overrides,
    });
}

function makeMockCollection(docs: any[] = []) {
    return {
        findOne: async (filter: any) =>
            docs.find(d => d.userId === filter.userId && d.moduleId === filter.moduleId) ?? null,
        updateOne: async (filter: any, update: any) => {
            const idx = docs.findIndex(d => d.userId === filter.userId && d.moduleId === filter.moduleId);
            if (idx < 0) return { matchedCount: 0 };
            docs[idx] = { ...docs[idx], ...update.$set };
            return { matchedCount: 1 };
        },
    };
}

function makeStore(docs: any[]) {
    return new UserModuleProgressStore({ db: { collection: () => makeMockCollection(docs) } as any, config: {} as any });
}

describe("UserModuleProgressStore.resetForRePractice", () => {

    it("returns the module to available and clears the ladder and its timestamps", async () => {
        const docs = [makeCompletedProgress().toBSON()];
        const result = await makeStore(docs).resetForRePractice("user-1", "mod-1");

        assert.equal(result!.status, "available");
        assert.isNull(result!.startedAt);
        assert.isNull(result!.completedAt);
        assert.isNull(result!.practiceCompletedAt);
        assert.equal(result!.currentRung, 1);
        assert.deepEqual(result!.rungCoverage, []);
    });

    it("increments passNumber", async () => {
        const docs = [makeCompletedProgress({ passNumber: 1 }).toBSON()];
        const result = await makeStore(docs).resetForRePractice("user-1", "mod-1");

        assert.equal(result!.passNumber, 2);
    });

    it("preserves testAttempts as history", async () => {
        const docs = [makeCompletedProgress().toBSON()];
        const result = await makeStore(docs).resetForRePractice("user-1", "mod-1");

        assert.equal(result!.testAttempts.length, 1);
        assert.equal(result!.testAttempts[0].id, "att-1");
    });

    it("preserves the proficiency sub-document, invisible only through GET /me/progress, not dropped here", async () => {
        const docs = [makeCompletedProgress().toBSON()];
        const result = await makeStore(docs).resetForRePractice("user-1", "mod-1");

        assert.isNotNull(result!.proficiency);
        assert.equal(result!.proficiency!.score, 69.5);
    });

    it("returns null when no progress record exists for the user + module", async () => {
        const result = await makeStore([]).resetForRePractice("user-1", "mod-1");

        assert.isNull(result);
    });
});
