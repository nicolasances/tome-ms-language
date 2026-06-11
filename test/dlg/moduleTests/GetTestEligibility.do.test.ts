import { assert } from "chai";
import { GetTestEligibility } from "../../../src/dlg/moduleTests/GetTestEligibility";
import { UserModuleProgress, TestAttemptRecord } from "../../../src/model/UserModuleProgress";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date("2026-06-11T14:00:00.000Z");

/**
 * Returns a practiceCompletedAt timestamp that is `hoursAgo` hours before NOW.
 */
function hoursBeforeNow(hoursAgo: number): string {
    return new Date(NOW.getTime() - hoursAgo * 60 * 60 * 1000).toISOString();
}

/**
 * Returns a takenAt timestamp that is `minutesAgo` minutes before NOW.
 */
function minutesBeforeNow(minutesAgo: number): string {
    return new Date(NOW.getTime() - minutesAgo * 60 * 1000).toISOString();
}

function makeProgress(overrides: Partial<ConstructorParameters<typeof UserModuleProgress>[0]> = {}): UserModuleProgress {
    return new UserModuleProgress({
        userId: "user-1",
        moduleId: "mod-1",
        status: "in_progress",
        startedAt: "2026-06-01T09:00:00.000Z",
        completedAt: null,
        testAttempts: [],
        ...overrides,
    });
}

function makeMockConfig(progressDoc: any | null) {

    const collections: Record<string, any> = {
        userModuleProgress: {
            findOne: async () => progressDoc,
        },
    };

    return {
        getDBName: () => "test",
        getMongoDb: async () => ({ collection: (name: string) => collections[name] }),
    } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GetTestEligibility.do", () => {

    it("returns not eligible when practiceCompletedAt is null (Step 2 not complete)", async () => {

        const progress = makeProgress({ practiceCompletedAt: null });
        const config = makeMockConfig(progress.toBSON());
        const delegate = new GetTestEligibility({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1", now: NOW }, {} as any);

        assert.isFalse(result.eligible);
        assert.isUndefined(result.testUnlocksAt);
    });

    it("returns not eligible when no progress record exists", async () => {

        const config = makeMockConfig(null);
        const delegate = new GetTestEligibility({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1", now: NOW }, {} as any);

        assert.isFalse(result.eligible);
        assert.isUndefined(result.testUnlocksAt);
    });

    it("returns not eligible with testUnlocksAt when unlock delay has not elapsed", async () => {

        // practiceCompletedAt was 2 hours ago — unlock requires 4 hours
        const progress = makeProgress({ practiceCompletedAt: hoursBeforeNow(2) });
        const config = makeMockConfig(progress.toBSON());
        const delegate = new GetTestEligibility({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1", now: NOW }, {} as any);

        assert.isFalse(result.eligible);
        assert.isString(result.testUnlocksAt);
        assert.isNumber(result.remainingMs);
        assert.isAbove(result.remainingMs!, 0);
    });

    it("returns eligible when unlock delay has elapsed and no prior failed attempt", async () => {

        // practiceCompletedAt was 5 hours ago — more than the 4-hour delay
        const progress = makeProgress({ practiceCompletedAt: hoursBeforeNow(5) });
        const config = makeMockConfig(progress.toBSON());
        const delegate = new GetTestEligibility({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1", now: NOW }, {} as any);

        assert.isTrue(result.eligible);
    });

    it("returns not eligible when retry delay has not elapsed after a failed attempt", async () => {

        // practiceCompletedAt: unlocked long ago; failed attempt 10 minutes ago (delay is 20 min)
        const failedAttempt = new TestAttemptRecord({ id: "att-1", score: 50, passed: false, takenAt: minutesBeforeNow(10) });
        const progress = makeProgress({
            practiceCompletedAt: hoursBeforeNow(10),
            testAttempts: [failedAttempt],
        });
        const config = makeMockConfig(progress.toBSON());
        const delegate = new GetTestEligibility({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1", now: NOW }, {} as any);

        assert.isFalse(result.eligible);
        assert.isString(result.testRetryAvailableAt);
        assert.isNumber(result.remainingMs);
        assert.isAbove(result.remainingMs!, 0);
    });

    it("returns eligible after retry delay has elapsed following a failed attempt", async () => {

        // Failed attempt 25 minutes ago (delay is 20 min)
        const failedAttempt = new TestAttemptRecord({ id: "att-1", score: 50, passed: false, takenAt: minutesBeforeNow(25) });
        const progress = makeProgress({
            practiceCompletedAt: hoursBeforeNow(10),
            testAttempts: [failedAttempt],
        });
        const config = makeMockConfig(progress.toBSON());
        const delegate = new GetTestEligibility({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1", now: NOW }, {} as any);

        assert.isTrue(result.eligible);
    });

    it("returns not eligible when the module is already completed (OQ-03: no retakes)", async () => {

        const progress = makeProgress({
            status: "completed",
            practiceCompletedAt: hoursBeforeNow(10),
        });
        const config = makeMockConfig(progress.toBSON());
        const delegate = new GetTestEligibility({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1", now: NOW }, {} as any);

        assert.isFalse(result.eligible);
    });

    it("ignores passed attempts when computing retry delay — only failed submitted attempts count", async () => {

        const passedAttempt = new TestAttemptRecord({ id: "att-1", score: 90, passed: true, takenAt: minutesBeforeNow(5) });
        const progress = makeProgress({
            practiceCompletedAt: hoursBeforeNow(10),
            testAttempts: [passedAttempt],
        });
        const config = makeMockConfig(progress.toBSON());
        const delegate = new GetTestEligibility({} as any, config);

        // A passed attempt should not trigger the retry delay
        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1", now: NOW }, {} as any);

        assert.isTrue(result.eligible);
    });

    it("uses the most recent failed attempt for the retry delay when multiple failed attempts exist", async () => {

        // Two failed attempts — the more recent one is 10 min ago (delay 20 min → still locked)
        const olderFailed = new TestAttemptRecord({ id: "att-1", score: 50, passed: false, takenAt: minutesBeforeNow(30) });
        const recentFailed = new TestAttemptRecord({ id: "att-2", score: 60, passed: false, takenAt: minutesBeforeNow(10) });
        const progress = makeProgress({
            practiceCompletedAt: hoursBeforeNow(10),
            testAttempts: [olderFailed, recentFailed],
        });
        const config = makeMockConfig(progress.toBSON());
        const delegate = new GetTestEligibility({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1", now: NOW }, {} as any);

        assert.isFalse(result.eligible);
    });
});
