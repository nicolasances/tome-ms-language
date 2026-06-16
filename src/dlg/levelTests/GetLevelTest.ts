import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { Exercise } from "../../model/Exercise";
import { TestAnswer } from "../../model/ModuleTestAttempt";
import { ExerciseStore } from "../../store/ExerciseStore";
import { LevelTestAttemptStore } from "../../store/LevelTestAttemptStore";

/**
 * Returns the current state of a Level Test attempt for resume after an app close (F21).
 *
 * Exercises are returned as full objects in the stored exerciseIds order — the same payload/shape
 * as a practice session, so the frontend can reuse the same exercise components. Correct answers
 * are not hidden in the exercise objects (identical to the module-test resume contract); the
 * per-answer feedback and review endpoints are the authoritative grading reads.
 * An in-progress attempt is always resumable regardless of cooldown timing.
 */
export class GetLevelTest extends TotoDelegate<GetLevelTestRequest, GetLevelTestResponse> {

    /**
     * Extracts userId and attemptId from the route parameters.
     */
    parseRequest(req: Request): GetLevelTestRequest {

        const userId = req.params.userId;
        const attemptId = req.params.attemptId;

        if (!userId) throw new ValidationError(400, "userId is required");
        if (!attemptId) throw new ValidationError(400, "attemptId is required");

        return { userId, attemptId };
    }

    /**
     * Returns the attempt state enriched with full exercise objects. Verifies ownership.
     *
     * @param {GetLevelTestRequest} req - The userId and attemptId.
     *
     * @returns {Promise<GetLevelTestResponse>} The resumable attempt state.
     */
    async do(req: GetLevelTestRequest, _userContext?: UserContext): Promise<GetLevelTestResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const attemptStore = new LevelTestAttemptStore({ db, config });
        const attempt = await attemptStore.findById(req.attemptId);

        if (!attempt) throw new ValidationError(404, `Level test attempt ${req.attemptId} not found`);
        if (attempt.userId !== req.userId) throw new ValidationError(403, "Attempt does not belong to the specified user");

        const exerciseStore = new ExerciseStore(db);
        const exercises = await exerciseStore.findByIds(attempt.exerciseIds);

        return {
            attemptId: attempt.id!,
            cefrLevel: attempt.cefrLevel,
            exercises,
            answers: attempt.answers,
            currentPosition: attempt.currentPosition,
            startedAt: attempt.startedAt,
            takenAt: attempt.takenAt,
        };
    }
}

interface GetLevelTestRequest {
    userId: string;     // The user id making the request
    attemptId: string;  // The id of the level test attempt to retrieve
}

interface GetLevelTestResponse {
    attemptId: string;          // The attempt id
    cefrLevel: string;          // The CEFR level being tested
    exercises: Exercise[];      // Full exercise objects, same shape as a practice session
    answers: TestAnswer[];      // Answers submitted so far
    currentPosition: number;    // 0-based index of the next unanswered exercise
    startedAt: string;          // ISO-8601 timestamp of when the attempt was started
    takenAt: string | null;     // ISO-8601 submission timestamp; null if in-progress
}
