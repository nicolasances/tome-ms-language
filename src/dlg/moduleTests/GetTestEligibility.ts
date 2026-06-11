import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { TEST_PASS_THRESHOLD, TEST_RETRY_DELAY_MINUTES, TEST_UNLOCK_DELAY_HOURS } from "../../Config";
import { ControllerConfig } from "../../Config";
import { UserModuleProgressStore } from "../../store/UserModuleProgressStore";

/**
 * Returns the authoritative test eligibility state for a given user and module (F11).
 *
 * Eligibility rules:
 * - The module must not already be `completed` (OQ-03: no retakes).
 * - `practiceCompletedAt` must be set on UserModuleProgress (Step 2 fully complete).
 * - `testUnlockDelayHours` must have elapsed since `practiceCompletedAt`.
 * - If a prior FAILED submitted attempt exists, `testRetryDelayMinutes` must have elapsed
 *   since the most recent failed attempt's `takenAt`. Passed attempts are ignored.
 */
export class GetTestEligibility extends TotoDelegate<GetTestEligibilityRequest, GetTestEligibilityResponse> {

    /**
     * Extracts userId and moduleId from the route parameters.
     */
    parseRequest(req: Request): GetTestEligibilityRequest {

        const userId = req.params.userId;
        const moduleId = req.params.moduleId;

        if (!userId) throw new ValidationError(400, "userId is required");
        if (!moduleId) throw new ValidationError(400, "moduleId is required");

        return { userId, moduleId, now: new Date() };
    }

    /**
     * Evaluates test eligibility for the given user and module.
     *
     * Returns `{ eligible: false }` (with no timestamps) when:
     * - No progress record exists, or `practiceCompletedAt` is null (Step 2 not complete).
     * - The module is already `completed` (no retakes — OQ-03).
     *
     * Returns `{ eligible: false, testUnlocksAt, remainingMs }` when the unlock delay has not elapsed.
     *
     * Returns `{ eligible: false, testRetryAvailableAt, remainingMs }` when a failed attempt's
     * retry delay has not elapsed.
     *
     * Returns `{ eligible: true, testUnlocksAt, testRetryAvailableAt? }` when all conditions pass.
     */
    async do(req: GetTestEligibilityRequest, _userContext?: UserContext): Promise<GetTestEligibilityResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        const now = req.now;

        const progressStore = new UserModuleProgressStore({ db, config });
        const progress = await progressStore.findByUserAndModule(req.userId, req.moduleId);

        if (!progress || !progress.practiceCompletedAt) {
            return { eligible: false };
        }

        if (progress.status === "completed") {
            return { eligible: false };
        }

        const testUnlocksAt = new Date(new Date(progress.practiceCompletedAt).getTime() + TEST_UNLOCK_DELAY_HOURS * 60 * 60 * 1000).toISOString();

        if (now < new Date(testUnlocksAt)) {
            return {
                eligible: false,
                testUnlocksAt,
                remainingMs: new Date(testUnlocksAt).getTime() - now.getTime(),
            };
        }

        const failedAttempts = progress.testAttempts.filter(a => !a.passed && a.takenAt);
        const mostRecentFailed = failedAttempts.sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime())[0];

        let testRetryAvailableAt: string | undefined;

        if (mostRecentFailed) {

            testRetryAvailableAt = new Date(new Date(mostRecentFailed.takenAt).getTime() + TEST_RETRY_DELAY_MINUTES * 60 * 1000).toISOString();

            if (now < new Date(testRetryAvailableAt)) {
                return {
                    eligible: false,
                    testRetryAvailableAt,
                    remainingMs: new Date(testRetryAvailableAt).getTime() - now.getTime(),
                };
            }
        }

        return {
            eligible: true,
            testUnlocksAt,
            testRetryAvailableAt,
        };
    }
}

interface GetTestEligibilityRequest {
    userId: string;     // The user id
    moduleId: string;   // The module id
    now: Date;          // The current time (injectable for testability)
}

interface GetTestEligibilityResponse {
    eligible: boolean;              // Whether the test may be started right now
    testUnlocksAt?: string;         // ISO-8601 timestamp when the test unlocks; absent when Step 2 is not complete
    testRetryAvailableAt?: string;  // ISO-8601 timestamp when a retry becomes available; present only after a failed attempt
    remainingMs?: number;           // Milliseconds until eligible; present only when eligible is false and a deadline is known
}
