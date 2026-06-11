import { assert } from "chai";
import { GetTestEligibility } from "../../../src/dlg/moduleTests/GetTestEligibility";
import { TEST_UNLOCK_DELAY_HOURS, TEST_RETRY_DELAY_MINUTES } from "../../../src/Config";
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

    it("testUnlocksAt equals practiceCompletedAt + TEST_UNLOCK_DELAY_HOURS when still locked", async () => {

        // practiceCompletedAt 2 hours ago — unlock requires 4 hours
        const practiceCompletedAt = hoursBeforeNow(2);
        const progress = makeProgress({ practiceCompletedAt });
        const config = makeMockConfig(progress.toBSON());
        const delegate = new GetTestEligibility({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1", now: NOW }, {} as any);

        const expectedTestUnlocksAt = new Date(new Date(practiceCompletedAt).getTime() + TEST_UNLOCK_DELAY_HOURS * 60 * 60 * 1000).toISOString();

        assert.isFalse(result.eligible);
        assert.equal(result.testUnlocksAt, expectedTestUnlocksAt, "testUnlocksAt must be practiceCompletedAt + TEST_UNLOCK_DELAY_HOURS");
    });

    it("remainingMs equals the exact milliseconds until testUnlocksAt when still locked", async () => {

        const practiceCompletedAt = hoursBeforeNow(2);
        const progress = makeProgress({ practiceCompletedAt });
        const config = makeMockConfig(progress.toBSON());
        const delegate = new GetTestEligibility({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1", now: NOW }, {} as any);

        const expectedTestUnlocksAt = new Date(new Date(practiceCompletedAt).getTime() + TEST_UNLOCK_DELAY_HOURS * 60 * 60 * 1000);
        const expectedRemainingMs = expectedTestUnlocksAt.getTime() - NOW.getTime();

        assert.equal(result.remainingMs, expectedRemainingMs, "remainingMs must be exact ms until testUnlocksAt");
        assert.isAbove(result.remainingMs!, 0);
    });

    it("testUnlocksAt is still returned when eligible (for client countdown reference)", async () => {

        // practiceCompletedAt 5 hours ago — more than the 4-hour delay
        const practiceCompletedAt = hoursBeforeNow(5);
        const progress = makeProgress({ practiceCompletedAt });
        const config = makeMockConfig(progress.toBSON());
        const delegate = new GetTestEligibility({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1", now: NOW }, {} as any);

        const expectedTestUnlocksAt = new Date(new Date(practiceCompletedAt).getTime() + TEST_UNLOCK_DELAY_HOURS * 60 * 60 * 1000).toISOString();

        assert.isTrue(result.eligible);
        assert.equal(result.testUnlocksAt, expectedTestUnlocksAt, "testUnlocksAt must always be returned when practiceCompletedAt is set");
        assert.isUndefined(result.remainingMs, "remainingMs must be absent when eligible");
    });

    it("testRetryAvailableAt equals takenAt + TEST_RETRY_DELAY_MINUTES when retry locked", async () => {

        // Failed attempt 10 minutes ago — retry delay is 20 min
        const takenAt = minutesBeforeNow(10);
        const failedAttempt = new TestAttemptRecord({ id: "att-1", score: 50, passed: false, takenAt });
        const progress = makeProgress({
            practiceCompletedAt: hoursBeforeNow(10),
            testAttempts: [failedAttempt],
        });
        const config = makeMockConfig(progress.toBSON());
        const delegate = new GetTestEligibility({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1", now: NOW }, {} as any);

        const expectedRetryAt = new Date(new Date(takenAt).getTime() + TEST_RETRY_DELAY_MINUTES * 60 * 1000).toISOString();

        assert.isFalse(result.eligible);
        assert.equal(result.testRetryAvailableAt, expectedRetryAt, "testRetryAvailableAt must be takenAt + TEST_RETRY_DELAY_MINUTES");
    });

    it("remainingMs equals the exact milliseconds until testRetryAvailableAt when retry locked", async () => {

        const takenAt = minutesBeforeNow(10);
        const failedAttempt = new TestAttemptRecord({ id: "att-1", score: 50, passed: false, takenAt });
        const progress = makeProgress({
            practiceCompletedAt: hoursBeforeNow(10),
            testAttempts: [failedAttempt],
        });
        const config = makeMockConfig(progress.toBSON());
        const delegate = new GetTestEligibility({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1", now: NOW }, {} as any);

        const expectedRetryAt = new Date(new Date(takenAt).getTime() + TEST_RETRY_DELAY_MINUTES * 60 * 1000);
        const expectedRemainingMs = expectedRetryAt.getTime() - NOW.getTime();

        assert.equal(result.remainingMs, expectedRemainingMs, "remainingMs must be exact ms until testRetryAvailableAt");
        assert.isAbove(result.remainingMs!, 0);
    });

    it("testRetryAvailableAt is still returned when eligible after retry delay has elapsed", async () => {

        // Failed attempt 25 min ago (delay 20 min → now eligible)
        const takenAt = minutesBeforeNow(25);
        const failedAttempt = new TestAttemptRecord({ id: "att-1", score: 50, passed: false, takenAt });
        const progress = makeProgress({
            practiceCompletedAt: hoursBeforeNow(10),
            testAttempts: [failedAttempt],
        });
        const config = makeMockConfig(progress.toBSON());
        const delegate = new GetTestEligibility({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1", now: NOW }, {} as any);

        const expectedRetryAt = new Date(new Date(takenAt).getTime() + TEST_RETRY_DELAY_MINUTES * 60 * 1000).toISOString();

        assert.isTrue(result.eligible);
        assert.equal(result.testRetryAvailableAt, expectedRetryAt, "testRetryAvailableAt must still be returned when eligible, for client display");
        assert.isUndefined(result.remainingMs, "remainingMs must be absent when eligible");
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

    it("ignores passed attempts — testRetryAvailableAt is absent when there are no failed attempts", async () => {

        const passedAttempt = new TestAttemptRecord({ id: "att-1", score: 90, passed: true, takenAt: minutesBeforeNow(5) });
        const progress = makeProgress({
            practiceCompletedAt: hoursBeforeNow(10),
            testAttempts: [passedAttempt],
        });
        const config = makeMockConfig(progress.toBSON());
        const delegate = new GetTestEligibility({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1", now: NOW }, {} as any);

        assert.isTrue(result.eligible);
        assert.isUndefined(result.testRetryAvailableAt, "testRetryAvailableAt must be absent when there are no failed attempts");
    });

    it("uses the most recent failed attempt's takenAt when computing testRetryAvailableAt", async () => {

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

        const expectedRetryAt = new Date(new Date(recentFailed.takenAt).getTime() + TEST_RETRY_DELAY_MINUTES * 60 * 1000).toISOString();

        assert.isFalse(result.eligible);
        assert.equal(result.testRetryAvailableAt, expectedRetryAt, "must anchor to the most recent failed attempt, not the older one");
    });
});
