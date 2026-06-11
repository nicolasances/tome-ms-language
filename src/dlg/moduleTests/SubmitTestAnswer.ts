import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { ExerciseStore } from "../../store/ExerciseStore";
import { ModuleTestAttemptStore } from "../../store/ModuleTestAttemptStore";
import { checkAnswer } from "../../util/AnswerChecker";

/**
 * Submits a single answer for one exercise in an in-progress Module Test attempt (F11).
 *
 * Business rules:
 * - The attempt must exist and not yet be submitted (`takenAt` null).
 * - The `exerciseId` must belong to the attempt's `exerciseIds` list.
 * - The answer is checked via normalised matching (same logic as F10).
 * - The first answer to each exercise is final for grading — there is no retry queue.
 * - Immediate feedback is returned: on a wrong answer, the correct answer is included.
 * - `timesShown` is incremented on the exercise (same as practice).
 */
export class SubmitTestAnswer extends TotoDelegate<SubmitTestAnswerRequest, SubmitTestAnswerResponse> {

    /**
     * Extracts userId, attemptId, exerciseId, and userAnswer from the request.
     */
    parseRequest(req: Request): SubmitTestAnswerRequest {

        const userId = req.params.userId;
        const attemptId = req.params.attemptId;
        const exerciseId = req.body?.exerciseId;
        const userAnswer = req.body?.userAnswer;

        if (!userId) throw new ValidationError(400, "userId is required");
        if (!attemptId) throw new ValidationError(400, "attemptId is required");
        if (!exerciseId) throw new ValidationError(400, "exerciseId is required");
        if (userAnswer === undefined || userAnswer === null) throw new ValidationError(400, "userAnswer is required");

        return { userId, attemptId, exerciseId, userAnswer: String(userAnswer) };
    }

    /**
     * Checks the answer, stores the result, advances the cursor, and returns immediate feedback.
     * Does not add to any retry queue — first answer is final.
     */
    async do(req: SubmitTestAnswerRequest, _userContext?: UserContext): Promise<SubmitTestAnswerResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const attemptStore = new ModuleTestAttemptStore({ db, config });
        const attempt = await attemptStore.findById(req.attemptId);

        if (!attempt) throw new ValidationError(404, `Module test attempt ${req.attemptId} not found`);
        if (attempt.takenAt !== null) throw new ValidationError(400, "Attempt is already submitted");

        if (!attempt.exerciseIds.includes(req.exerciseId)) {
            throw new ValidationError(400, `Exercise ${req.exerciseId} is not part of this attempt`);
        }

        const exerciseStore = new ExerciseStore(db);
        const exercise = await exerciseStore.findById(req.exerciseId);

        if (!exercise) throw new ValidationError(404, `Exercise ${req.exerciseId} not found`);

        const { isCorrect, correctAnswer } = checkAnswer(req.userAnswer, exercise);

        const now = new Date().toISOString();

        await attemptStore.appendAnswer(req.attemptId, {
            exerciseId: req.exerciseId,
            isCorrect,
            userAnswer: req.userAnswer,
            answeredAt: now,
        });

        await attemptStore.advancePosition(req.attemptId);

        await exerciseStore.incrementTimesShown(req.exerciseId);

        return { isCorrect, correctAnswer };
    }
}

interface SubmitTestAnswerRequest {
    userId: string;     // The user id
    attemptId: string;  // The module test attempt id
    exerciseId: string; // The exercise being answered
    userAnswer: string; // The raw answer string submitted by the user
}

interface SubmitTestAnswerResponse {
    isCorrect: boolean;     // Whether the answer was judged correct
    correctAnswer: string;  // The correct answer; always returned for immediate feedback
}
