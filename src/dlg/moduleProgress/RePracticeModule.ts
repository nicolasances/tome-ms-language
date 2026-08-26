import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { PracticeSessionStore } from "../../store/PracticeSessionStore";
import { ModuleTestAttemptStore } from "../../store/ModuleTestAttemptStore";
import { UserModuleProgressStore } from "../../store/UserModuleProgressStore";

/**
 * Thrown when an open practice session would be stranded by the reset.
 * The client must resume it via the existing session-resume flow, then retry the reset.
 */
class ActiveSessionError extends ValidationError {

    sessionId: string;

    constructor(sessionId: string) {
        super(409, "An active practice session is still open for this module");
        this.sessionId = sessionId;
    }
}

/**
 * Thrown when an open (un-submitted) test attempt would be stranded by the reset.
 * The client must resume it via GET …/moduleTests/:attemptId, then retry the reset.
 */
class ActiveAttemptError extends ValidationError {

    attemptId: string;

    constructor(attemptId: string) {
        super(409, "An active module test attempt is still open for this module");
        this.attemptId = attemptId;
    }
}

/**
 * Resets a completed module for a new pass (F25 — Module Re-practice).
 *
 * Business rules enforced:
 * - 404 if no progress record exists for the user + module.
 * - 400 if the module's status is not `completed` — there is nothing to reset.
 * - 409 (with `sessionId`) if an open practice session exists — resetting would strand the user
 *   the moment they tried to act on the module again.
 * - 409 (with `attemptId`) if an open test attempt exists, for the same reason.
 * - Otherwise: resets the module via `UserModuleProgressStore.resetForRePractice` — status back
 *   to `available`, the ladder cleared, `passNumber` incremented — preserving `testAttempts` and
 *   `proficiency`. The reset is irreversible: there is no un-reset and no abandon.
 */
export class RePracticeModule extends TotoDelegate<RePracticeModuleRequest, RePracticeModuleResponse> {

    /**
     * Extracts userId and moduleId from the route parameters.
     */
    parseRequest(req: Request): RePracticeModuleRequest {

        const userId = req.params.userId;
        const moduleId = req.params.moduleId;

        if (!userId) throw new ValidationError(400, "userId is required");
        if (!moduleId) throw new ValidationError(400, "moduleId is required");

        return { userId, moduleId };
    }

    /**
     * Verifies the module is completed and quiet, then resets it for a new pass.
     */
    async do(req: RePracticeModuleRequest, _userContext?: UserContext): Promise<RePracticeModuleResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const progressStore = new UserModuleProgressStore({ db, config });
        const progress = await progressStore.findByUserAndModule(req.userId, req.moduleId);

        if (!progress) throw new ValidationError(404, `No progress record for user ${req.userId} and module ${req.moduleId}`);
        if (progress.status !== "completed") throw new ValidationError(400, "Module is not completed — there is nothing to reset");

        const practiceSessionStore = new PracticeSessionStore({ db, config });
        const activeSession = await practiceSessionStore.findActiveByUserAndModule(req.userId, req.moduleId);

        if (activeSession) throw new ActiveSessionError(activeSession.id!);

        const attemptStore = new ModuleTestAttemptStore({ db, config });
        const activeAttempt = await attemptStore.findActiveByUserAndModule(req.userId, req.moduleId);

        if (activeAttempt) throw new ActiveAttemptError(activeAttempt.id!);

        const reset = await progressStore.resetForRePractice(req.userId, req.moduleId);

        return {
            moduleId: req.moduleId,
            status: reset!.status,
            startedAt: reset!.startedAt,
            completedAt: reset!.completedAt,
            practiceCompletedAt: reset!.practiceCompletedAt,
            currentRung: reset!.currentRung,
            passNumber: reset!.passNumber,
        };
    }
}

interface RePracticeModuleRequest {
    userId: string;     // The user id
    moduleId: string;   // The module id
}

interface RePracticeModuleResponse {
    moduleId: string;                    // The module id
    status: string;                      // The module's status after the reset — always "available"
    startedAt: string | null;            // Always null — re-stamped when the new pass's first practice session starts
    completedAt: string | null;          // Always null — the reset un-completes the module
    practiceCompletedAt: string | null;  // Always null — re-stamped when the new pass's ladder completes
    currentRung: number;                 // Always the first rung — the new pass starts the ladder over
    passNumber: number;                  // The new pass number the module is now on
}
