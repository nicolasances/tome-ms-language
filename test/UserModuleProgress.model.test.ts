import { strict as assert } from "assert";
import { ModuleTestAttempt, UserModuleProgress } from "../src/model/UserModuleProgress";

describe("ModuleTestAttempt.fromBSON", () => {

    it("round-trips all fields through toBSON and fromBSON", () => {
        const attempt = new ModuleTestAttempt({ id: "att-1", score: 85, passed: true, takenAt: "2026-06-01T10:00:00.000Z" });
        const result = ModuleTestAttempt.fromBSON(attempt.toBSON());

        assert.equal(result.id, "att-1");
        assert.equal(result.score, 85);
        assert.equal(result.passed, true);
        assert.equal(result.takenAt, "2026-06-01T10:00:00.000Z");
    });

    it("preserves a failed attempt", () => {
        const attempt = new ModuleTestAttempt({ id: "att-2", score: 40, passed: false, takenAt: "2026-06-02T08:00:00.000Z" });
        const result = ModuleTestAttempt.fromBSON(attempt.toBSON());

        assert.equal(result.passed, false);
        assert.equal(result.score, 40);
    });
});

describe("UserModuleProgress.fromBSON", () => {

    it("round-trips all fields through toBSON and fromBSON", () => {
        const progress = new UserModuleProgress({
            userId: "user-1",
            moduleId: "mod-1",
            status: "in_progress",
            startedAt: "2026-06-01T09:00:00.000Z",
            completedAt: null,
            vocabularyItemsPracticed: ["v-1", "v-2"],
            practiceCompletedAt: "2026-06-02T09:00:00.000Z",
            testAttempts: [],
        });

        const result = UserModuleProgress.fromBSON(progress.toBSON());

        assert.equal(result.userId, "user-1");
        assert.equal(result.moduleId, "mod-1");
        assert.equal(result.status, "in_progress");
        assert.equal(result.startedAt, "2026-06-01T09:00:00.000Z");
        assert.equal(result.completedAt, null);
        assert.deepEqual(result.vocabularyItemsPracticed, ["v-1", "v-2"]);
        assert.equal(result.practiceCompletedAt, "2026-06-02T09:00:00.000Z");
        assert.deepEqual(result.testAttempts, []);
    });

    it("defaults vocabularyItemsPracticed to [] and practiceCompletedAt to null when absent from the document", () => {
        const doc: any = { userId: "user-1", moduleId: "mod-1", status: "available", startedAt: null, completedAt: null };
        const result = UserModuleProgress.fromBSON(doc);

        assert.deepEqual(result.vocabularyItemsPracticed, []);
        assert.equal(result.practiceCompletedAt, null);
    });

    it("round-trips embedded testAttempts", () => {
        const attempt = new ModuleTestAttempt({ id: "att-1", score: 90, passed: true, takenAt: "2026-06-03T12:00:00.000Z" });
        const progress = new UserModuleProgress({
            userId: "user-1",
            moduleId: "mod-1",
            status: "completed",
            startedAt: "2026-06-01T09:00:00.000Z",
            completedAt: "2026-06-03T12:00:00.000Z",
            testAttempts: [attempt],
        });

        const result = UserModuleProgress.fromBSON(progress.toBSON());

        assert.equal(result.testAttempts.length, 1);
        assert.equal(result.testAttempts[0].id, "att-1");
        assert.equal(result.testAttempts[0].score, 90);
        assert.equal(result.testAttempts[0].passed, true);
    });

    it("defaults testAttempts to [] when absent from the document", () => {
        const doc: any = { userId: "user-1", moduleId: "mod-1", status: "available", startedAt: null, completedAt: null };
        const result = UserModuleProgress.fromBSON(doc);

        assert.deepEqual(result.testAttempts, []);
    });

    it("handles null startedAt and completedAt", () => {
        const progress = new UserModuleProgress({
            userId: "user-1",
            moduleId: "mod-1",
            status: "available",
            startedAt: null,
            completedAt: null,
            testAttempts: [],
        });

        const result = UserModuleProgress.fromBSON(progress.toBSON());

        assert.equal(result.startedAt, null);
        assert.equal(result.completedAt, null);
    });
});
