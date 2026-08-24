import { strict as assert } from "assert";
import { ModuleProficiency, RungCoverage, TestAttemptRecord, UserModuleProgress } from "../../src/model/UserModuleProgress";

describe("ModuleProficiency.fromBSON", () => {

    it("round-trips all fields through toBSON and fromBSON", () => {
        const proficiency = new ModuleProficiency({ score: 88.6, testScore: 86.4, practiceScore: 92, basis: "full", computedAt: "2026-08-16T10:00:00.000Z", version: 1 });
        const result = ModuleProficiency.fromBSON(proficiency.toBSON());

        assert.equal(result.score, 88.6);
        assert.equal(result.testScore, 86.4);
        assert.equal(result.practiceScore, 92);
        assert.equal(result.basis, "full");
        assert.equal(result.computedAt, "2026-08-16T10:00:00.000Z");
        assert.equal(result.version, 1);
    });

    it("preserves a null practiceScore on a test-only score", () => {
        const proficiency = new ModuleProficiency({ score: 57.1, testScore: 57.1, practiceScore: null, basis: "test-only", computedAt: "2026-08-16T10:00:00.000Z", version: 1 });
        const result = ModuleProficiency.fromBSON(proficiency.toBSON());

        assert.equal(result.practiceScore, null);
        assert.equal(result.basis, "test-only");
    });

    it("defaults passNumber to 1 when absent from the document (F25 — legacy scores predate re-practice)", () => {
        const result = ModuleProficiency.fromBSON({ score: 88.6, testScore: 86.4, practiceScore: 92, basis: "full", computedAt: "2026-08-16T10:00:00.000Z", version: 1 });

        assert.equal(result.passNumber, 1);
    });

    it("round-trips a non-default passNumber through toBSON and fromBSON", () => {
        const proficiency = new ModuleProficiency({ score: 60, testScore: 60, practiceScore: null, basis: "test-only", computedAt: "2026-08-16T10:00:00.000Z", version: 1, passNumber: 2 });
        const result = ModuleProficiency.fromBSON(proficiency.toBSON());

        assert.equal(proficiency.toBSON().passNumber, 2);
        assert.equal(result.passNumber, 2);
    });
});

describe("TestAttemptRecord.fromBSON", () => {

    it("round-trips all fields through toBSON and fromBSON", () => {
        const attempt = new TestAttemptRecord({ id: "att-1", score: 85, passed: true, takenAt: "2026-06-01T10:00:00.000Z" });
        const result = TestAttemptRecord.fromBSON(attempt.toBSON());

        assert.equal(result.id, "att-1");
        assert.equal(result.score, 85);
        assert.equal(result.passed, true);
        assert.equal(result.takenAt, "2026-06-01T10:00:00.000Z");
    });

    it("preserves a failed attempt", () => {
        const attempt = new TestAttemptRecord({ id: "att-2", score: 40, passed: false, takenAt: "2026-06-02T08:00:00.000Z" });
        const result = TestAttemptRecord.fromBSON(attempt.toBSON());

        assert.equal(result.passed, false);
        assert.equal(result.score, 40);
    });
});

describe("RungCoverage.fromBSON", () => {

    it("round-trips all fields through toBSON and fromBSON", () => {
        const coverage = new RungCoverage({ rung: 2, itemIds: ["v-1", "g-1"], completedAt: "2026-06-02T09:00:00.000Z" });
        const result = RungCoverage.fromBSON(coverage.toBSON());

        assert.equal(result.rung, 2);
        assert.deepEqual(result.itemIds, ["v-1", "g-1"]);
        assert.equal(result.completedAt, "2026-06-02T09:00:00.000Z");
    });

    it("defaults itemIds to [] and completedAt to null when absent from the document", () => {
        const result = RungCoverage.fromBSON({ rung: 1 });

        assert.deepEqual(result.itemIds, []);
        assert.equal(result.completedAt, null);
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
            currentRung: 2,
            rungCoverage: [new RungCoverage({ rung: 1, itemIds: ["v-1", "v-2"], completedAt: "2026-06-02T08:00:00.000Z" })],
            practiceCompletedAt: "2026-06-02T09:00:00.000Z",
            testAttempts: [],
        });

        const result = UserModuleProgress.fromBSON(progress.toBSON());

        assert.equal(result.userId, "user-1");
        assert.equal(result.moduleId, "mod-1");
        assert.equal(result.status, "in_progress");
        assert.equal(result.startedAt, "2026-06-01T09:00:00.000Z");
        assert.equal(result.completedAt, null);
        assert.equal(result.currentRung, 2);
        assert.equal(result.rungCoverage.length, 1);
        assert.equal(result.rungCoverage[0].rung, 1);
        assert.deepEqual(result.rungCoverage[0].itemIds, ["v-1", "v-2"]);
        assert.equal(result.rungCoverage[0].completedAt, "2026-06-02T08:00:00.000Z");
        assert.equal(result.practiceCompletedAt, "2026-06-02T09:00:00.000Z");
        assert.deepEqual(result.testAttempts, []);
    });

    it("round-trips the proficiency sub-document", () => {
        const progress = new UserModuleProgress({
            userId: "user-1",
            moduleId: "mod-1",
            status: "completed",
            startedAt: "2026-06-01T09:00:00.000Z",
            completedAt: "2026-06-05T09:00:00.000Z",
            testAttempts: [],
            proficiency: new ModuleProficiency({ score: 69.5, testScore: 57.1, practiceScore: 88, basis: "full", computedAt: "2026-08-16T10:00:00.000Z", version: 1 }),
        });

        const result = UserModuleProgress.fromBSON(progress.toBSON());

        assert.equal(result.proficiency!.score, 69.5);
        assert.equal(result.proficiency!.basis, "full");
    });

    it("defaults proficiency to null when absent from the document", () => {
        const doc: any = { userId: "user-1", moduleId: "mod-1", status: "completed", startedAt: null, completedAt: null };
        const result = UserModuleProgress.fromBSON(doc);

        assert.equal(result.proficiency, null);
    });

    it("defaults currentRung to the first rung and rungCoverage to [] when absent from the document", () => {
        const doc: any = { userId: "user-1", moduleId: "mod-1", status: "available", startedAt: null, completedAt: null };
        const result = UserModuleProgress.fromBSON(doc);

        assert.equal(result.currentRung, 1);
        assert.deepEqual(result.rungCoverage, []);
        assert.equal(result.practiceCompletedAt, null);
    });

    it("defaults passNumber to 1 when absent from the document (F25 — legacy records predate re-practice)", () => {
        const doc: any = { userId: "user-1", moduleId: "mod-1", status: "completed", startedAt: null, completedAt: null };
        const result = UserModuleProgress.fromBSON(doc);

        assert.equal(result.passNumber, 1);
    });

    it("round-trips a non-default passNumber through toBSON and fromBSON", () => {
        const progress = new UserModuleProgress({
            userId: "user-1", moduleId: "mod-1", status: "available", startedAt: null, completedAt: null, testAttempts: [], passNumber: 2,
        });

        const result = UserModuleProgress.fromBSON(progress.toBSON());

        assert.equal(progress.toBSON().passNumber, 2);
        assert.equal(result.passNumber, 2);
    });

    it("ignores a legacy vocabularyItemsPracticed field left over from before the practice ladder", () => {
        const doc: any = { userId: "user-1", moduleId: "mod-1", status: "in_progress", startedAt: null, completedAt: null, vocabularyItemsPracticed: ["v-1", "v-2"] };
        const result = UserModuleProgress.fromBSON(doc);

        assert.deepEqual(result.rungCoverage, []);
        assert.equal((result as any).vocabularyItemsPracticed, undefined);
    });

    it("coverageAt returns the entry for the requested rung", () => {
        const progress = new UserModuleProgress({
            userId: "user-1", moduleId: "mod-1", status: "in_progress", startedAt: null, completedAt: null, testAttempts: [],
            rungCoverage: [new RungCoverage({ rung: 1, itemIds: ["v-1"] }), new RungCoverage({ rung: 2, itemIds: ["v-2"] })],
        });

        assert.deepEqual(progress.coverageAt(2)!.itemIds, ["v-2"]);
    });

    it("coverageAt returns null for a rung with no entry yet", () => {
        const progress = new UserModuleProgress({
            userId: "user-1", moduleId: "mod-1", status: "in_progress", startedAt: null, completedAt: null, testAttempts: [],
            rungCoverage: [new RungCoverage({ rung: 1, itemIds: ["v-1"] })],
        });

        assert.equal(progress.coverageAt(3), null);
    });

    it("completedRungCount counts only the rungs that carry a completedAt", () => {
        const progress = new UserModuleProgress({
            userId: "user-1", moduleId: "mod-1", status: "in_progress", startedAt: null, completedAt: null, testAttempts: [],
            rungCoverage: [
                new RungCoverage({ rung: 1, itemIds: ["v-1"], completedAt: "2026-06-02T08:00:00.000Z" }),
                new RungCoverage({ rung: 2, itemIds: ["v-1"], completedAt: null }),
            ],
        });

        assert.equal(progress.completedRungCount(), 1);
    });

    it("coveredItemIds unions the covered items across every rung", () => {
        const progress = new UserModuleProgress({
            userId: "user-1", moduleId: "mod-1", status: "in_progress", startedAt: null, completedAt: null, testAttempts: [],
            rungCoverage: [
                new RungCoverage({ rung: 1, itemIds: ["v-1", "v-2"] }),
                new RungCoverage({ rung: 2, itemIds: ["v-2", "g-1"] }),
            ],
        });

        assert.deepEqual([...progress.coveredItemIds()].sort(), ["g-1", "v-1", "v-2"]);
    });

    it("round-trips embedded testAttempts", () => {
        const attempt = new TestAttemptRecord({ id: "att-1", score: 90, passed: true, takenAt: "2026-06-03T12:00:00.000Z" });
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
