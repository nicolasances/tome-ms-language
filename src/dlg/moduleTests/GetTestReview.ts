import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { ExerciseStore } from "../../store/ExerciseStore";
import { ModuleTestAttemptStore } from "../../store/ModuleTestAttemptStore";

/**
 * Returns the full review of a completed Module Test attempt (F11).
 *
 * Exposes correct answers for every question — unlike `GetModuleTest`, which
 * hides correct answers for in-progress attempts.
 *
 * For each question the review includes:
 * - The exercise prompt (via the full exercise object)
 * - `isCorrect`, `userAnswer`, and `correctAnswer`
 *
 * Unanswered exercises are represented as incorrect with an empty `userAnswer`.
 *
 * Enables "Explain my mistake" (F12) per incorrect item.
 */
export class GetTestReview extends TotoDelegate<GetTestReviewRequest, GetTestReviewResponse> {

    /**
     * Extracts userId and attemptId from the route parameters.
     */
    parseRequest(req: Request): GetTestReviewRequest {

        const userId = req.params.userId;
        const attemptId = req.params.attemptId;

        if (!userId) throw new ValidationError(400, "userId is required");
        if (!attemptId) throw new ValidationError(400, "attemptId is required");

        return { userId, attemptId };
    }

    /**
     * Returns the graded review for a submitted attempt.
     * Validates ownership, submission state, then returns score + per-question results.
     */
    async do(req: GetTestReviewRequest, _userContext?: UserContext): Promise<GetTestReviewResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const attemptStore = new ModuleTestAttemptStore({ db, config });
        const attempt = await attemptStore.findById(req.attemptId);

        if (!attempt) throw new ValidationError(404, `Module test attempt ${req.attemptId} not found`);
        if (attempt.userId !== req.userId) throw new ValidationError(403, "Attempt does not belong to the specified user");
        if (attempt.takenAt === null) throw new ValidationError(400, "Attempt is not yet submitted");

        const exerciseStore = new ExerciseStore(db);
        const exercises = await exerciseStore.findByIds(attempt.exerciseIds);
        const exerciseById = new Map(exercises.map(e => [e.id, e]));

        const answerByExerciseId = new Map(attempt.answers.map(a => [a.exerciseId, a]));

        const questions: ReviewQuestion[] = attempt.exerciseIds.map(exerciseId => {

            const exercise = exerciseById.get(exerciseId);
            const answer = answerByExerciseId.get(exerciseId);

            return {
                exerciseId,
                prompt: exercise?.prompt ?? "",
                isCorrect: answer?.isCorrect ?? false,
                userAnswer: answer?.userAnswer ?? "",
                correctAnswer: exercise?.answer ?? "",
            };
        });

        return {
            score: attempt.score!,
            passed: attempt.passed!,
            questions,
        };
    }
}

interface ReviewQuestion {
    exerciseId: string;     // The exercise id
    prompt: string;         // The exercise prompt
    isCorrect: boolean;     // Whether the user's answer was correct
    userAnswer: string;     // The user's submitted answer (empty string if unanswered)
    correctAnswer: string;  // The correct answer — always exposed in the review
}

interface GetTestReviewRequest {
    userId: string;     // The user id making the request
    attemptId: string;  // The attempt id to review
}

interface GetTestReviewResponse {
    score: number;                  // Percentage correct (0–100)
    passed: boolean;                // Whether the attempt passed
    questions: ReviewQuestion[];    // Per-question review items
}
