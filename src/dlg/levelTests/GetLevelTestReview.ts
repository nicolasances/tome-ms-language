import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { ExerciseStore } from "../../store/ExerciseStore";
import { LevelTestAttemptStore } from "../../store/LevelTestAttemptStore";

/**
 * Returns the full review of a completed Level Test attempt (F21).
 *
 * Exposes correct answers for every question — unlike `GetLevelTest`, which is the in-progress
 * resume read. For each question the review includes the prompt, `isCorrect`, `userAnswer` and
 * `correctAnswer`. Unanswered exercises are represented as incorrect with an empty `userAnswer`.
 *
 * It also returns a weak-areas summary: the distinct vocabulary items and grammar concepts the
 * user answered incorrectly (any incorrect answer flags the linked item — OQ-03). Enables
 * "Explain my mistake" (F12) per incorrect item.
 */
export class GetLevelTestReview extends TotoDelegate<GetLevelTestReviewRequest, GetLevelTestReviewResponse> {

    /**
     * Extracts userId and attemptId from the route parameters.
     */
    parseRequest(req: Request): GetLevelTestReviewRequest {

        const userId = req.params.userId;
        const attemptId = req.params.attemptId;

        if (!userId) throw new ValidationError(400, "userId is required");
        if (!attemptId) throw new ValidationError(400, "attemptId is required");

        return { userId, attemptId };
    }

    /**
     * Returns the graded review for a submitted attempt, including the weak-areas summary.
     * Validates ownership and submission state first.
     *
     * @param {GetLevelTestReviewRequest} req - The userId and attemptId.
     *
     * @returns {Promise<GetLevelTestReviewResponse>} Score, per-question review, and weak areas.
     */
    async do(req: GetLevelTestReviewRequest, _userContext?: UserContext): Promise<GetLevelTestReviewResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const attemptStore = new LevelTestAttemptStore({ db, config });
        const attempt = await attemptStore.findById(req.attemptId);

        if (!attempt) throw new ValidationError(404, `Level test attempt ${req.attemptId} not found`);
        if (attempt.userId !== req.userId) throw new ValidationError(403, "Attempt does not belong to the specified user");
        if (attempt.takenAt === null) throw new ValidationError(400, "Attempt is not yet submitted");

        const exerciseStore = new ExerciseStore(db);
        const exercises = await exerciseStore.findByIds(attempt.exerciseIds);
        const exerciseById = new Map(exercises.map(e => [e.id, e]));

        const answerByExerciseId = new Map(attempt.answers.map(a => [a.exerciseId, a]));

        const weakVocabulary = new Set<string>();
        const weakGrammar = new Set<string>();

        const questions: ReviewQuestion[] = attempt.exerciseIds.map(exerciseId => {

            const exercise = exerciseById.get(exerciseId);
            const answer = answerByExerciseId.get(exerciseId);
            const isCorrect = answer?.isCorrect ?? false;

            if (!isCorrect && exercise) {
                if (exercise.vocabularyItemId) weakVocabulary.add(exercise.vocabularyItemId);
                else if (exercise.grammarConceptId) weakGrammar.add(exercise.grammarConceptId);
            }

            return {
                exerciseId,
                prompt: exercise?.prompt ?? "",
                isCorrect,
                userAnswer: answer?.userAnswer ?? "",
                correctAnswer: exercise?.answer ?? "",
            };
        });

        return {
            score: attempt.score!,
            passed: attempt.passed!,
            questions,
            weakAreas: { vocabulary: [...weakVocabulary], grammar: [...weakGrammar] },
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

interface WeakAreas {
    vocabulary: string[];   // Distinct vocabulary item ids the user answered incorrectly
    grammar: string[];      // Distinct grammar concept ids the user answered incorrectly
}

interface GetLevelTestReviewRequest {
    userId: string;     // The user id making the request
    attemptId: string;  // The attempt id to review
}

interface GetLevelTestReviewResponse {
    score: number;                  // Percentage correct (0–100)
    passed: boolean;                // Whether the attempt passed
    questions: ReviewQuestion[];    // Per-question review items
    weakAreas: WeakAreas;           // Vocabulary + grammar the user underperformed on
}
