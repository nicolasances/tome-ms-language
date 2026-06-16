import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig, LEVEL_TEST_RETRY_DELAY_MINUTES } from "../../Config";
import { LevelTestAttemptStore } from "../../store/LevelTestAttemptStore";
import { ModuleStore } from "../../store/ModuleStore";
import { UserModuleProgressStore } from "../../store/UserModuleProgressStore";
import { UserStore } from "../../store/UserStore";

/**
 * Returns the authoritative Level Test eligibility state for a user at their current CEFR level (F21).
 *
 * Eligibility rules:
 * - All **curated** (non-user-generated) modules at the user's current level must be `completed`.
 *   User-generated modules do not block. A level with no curated modules is not eligible.
 * - An in-progress (un-submitted) attempt makes the user eligible to *resume* it (`activeAttemptId`),
 *   bypassing the cooldown.
 * - Otherwise, the 30-minute inter-attempt cooldown must have elapsed since the most recent
 *   submitted attempt's `takenAt`.
 */
export class GetLevelTestEligibility extends TotoDelegate<GetLevelTestEligibilityRequest, GetLevelTestEligibilityResponse> {

    /**
     * Extracts userId from the route parameters.
     */
    parseRequest(req: Request): GetLevelTestEligibilityRequest {

        const userId = req.params.userId;

        if (!userId) throw new ValidationError(400, "userId is required");

        return { userId, now: new Date() };
    }

    /**
     * Evaluates Level Test eligibility for the given user at their current level.
     *
     * @param {GetLevelTestEligibilityRequest} req - The userId and current time.
     *
     * @returns {Promise<GetLevelTestEligibilityResponse>} The eligibility verdict.
     */
    async do(req: GetLevelTestEligibilityRequest, _userContext?: UserContext): Promise<GetLevelTestEligibilityResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        const now = req.now;

        const user = await new UserStore({ db, config }).findById(req.userId);

        if (!user) throw new ValidationError(404, `User ${req.userId} not found`);

        const cefrLevel = user.cefrLevel;

        const curatedModules = await new ModuleStore(db).list(cefrLevel, false);

        if (curatedModules.length === 0) {
            return { eligible: false, reason: `No curated modules exist for level ${cefrLevel}` };
        }

        const progressList = await new UserModuleProgressStore({ db, config }).listByUser(req.userId, curatedModules.map(m => m.id));
        const completedModuleIds = new Set(progressList.filter(p => p.status === "completed").map(p => p.moduleId));

        const allCompleted = curatedModules.every(m => completedModuleIds.has(m.id));

        if (!allCompleted) {
            return { eligible: false, reason: `Not all curated modules at level ${cefrLevel} are completed` };
        }

        const attemptStore = new LevelTestAttemptStore({ db, config });

        const activeAttempt = await attemptStore.findActiveByUserAndLevel(req.userId, cefrLevel);

        if (activeAttempt) {
            return { eligible: true, activeAttemptId: activeAttempt.id! };
        }

        const mostRecent = await attemptStore.findMostRecentSubmittedByUserAndLevel(req.userId, cefrLevel);

        if (mostRecent?.takenAt) {

            const retryAvailableAt = new Date(new Date(mostRecent.takenAt).getTime() + LEVEL_TEST_RETRY_DELAY_MINUTES * 60 * 1000);

            if (now < retryAvailableAt) {
                return {
                    eligible: false,
                    reason: "Cooldown not yet elapsed since the most recent attempt",
                    retryAvailableAt: retryAvailableAt.toISOString(),
                    remainingMs: retryAvailableAt.getTime() - now.getTime(),
                };
            }
        }

        return { eligible: true };
    }
}

interface GetLevelTestEligibilityRequest {
    userId: string;     // The user id
    now: Date;          // The current time (injectable for testability)
}

interface GetLevelTestEligibilityResponse {
    eligible: boolean;              // Whether the Level Test may be started/resumed right now
    reason?: string;               // Human-readable reason when not eligible
    retryAvailableAt?: string;     // ISO-8601 timestamp when the cooldown elapses; present only during cooldown
    remainingMs?: number;          // Milliseconds until eligible; present only during cooldown
    activeAttemptId?: string;      // Id of an in-progress attempt to resume; present only when one exists
}
