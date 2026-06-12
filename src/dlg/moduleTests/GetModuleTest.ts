import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { Exercise } from "../../model/Exercise";
import { ExerciseStore } from "../../store/ExerciseStore";
import { ModuleTestAttemptStore } from "../../store/ModuleTestAttemptStore";
import { TestAnswer } from "../../model/ModuleTestAttempt";

/**
 * Returns the current state of a Module Test attempt for resume after an app close (F11).
 *
 * Exercises are returned as full objects in the stored exerciseIds order — the same payload/shape
 * as a practice session, so the frontend can reuse the same exercise components.
 * An in-progress attempt is always resumable regardless of unlock timing.
 */
export class GetModuleTest extends TotoDelegate<GetModuleTestRequest, GetModuleTestResponse> {

    /**
     * Extracts userId and attemptId from the route parameters.
     */
    parseRequest(req: Request): GetModuleTestRequest {

        const userId = req.params.userId;
        const attemptId = req.params.attemptId;

        if (!userId) throw new ValidationError(400, "userId is required");
        if (!attemptId) throw new ValidationError(400, "attemptId is required");

        return { userId, attemptId };
    }

    /**
     * Returns the attempt state enriched with full exercise objects (without correct answers).
     * Verifies ownership before returning any data.
     */
    async do(req: GetModuleTestRequest, _userContext?: UserContext): Promise<GetModuleTestResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const attemptStore = new ModuleTestAttemptStore({ db, config });
        const attempt = await attemptStore.findById(req.attemptId);

        if (!attempt) throw new ValidationError(404, `Module test attempt ${req.attemptId} not found`);
        if (attempt.userId !== req.userId) throw new ValidationError(403, "Attempt does not belong to the specified user");

        const exerciseStore = new ExerciseStore(db);
        const exercises = await exerciseStore.findByIds(attempt.exerciseIds);

        return {
            attemptId: attempt.id!,
            moduleId: attempt.moduleId,
            exercises,
            answers: attempt.answers,
            currentPosition: attempt.currentPosition,
            startedAt: attempt.startedAt,
            takenAt: attempt.takenAt,
        };
    }
}

interface GetModuleTestRequest {
    userId: string;     // The user id making the request
    attemptId: string;  // The id of the module test attempt to retrieve
}

interface GetModuleTestResponse {
    attemptId: string;          // The attempt id
    moduleId: string;           // The module id
    exercises: Exercise[];      // Full exercise objects, same shape as a practice session
    answers: TestAnswer[];      // Answers submitted so far
    currentPosition: number;    // 0-based index of the next unanswered exercise
    startedAt: string;          // ISO-8601 timestamp of when the attempt was started
    takenAt: string | null;     // ISO-8601 submission timestamp; null if in-progress
}
