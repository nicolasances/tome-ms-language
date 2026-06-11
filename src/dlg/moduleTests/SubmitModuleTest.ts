import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { TEST_PASS_THRESHOLD } from "../../Config";
import { ControllerConfig } from "../../Config";
import { ExerciseResult } from "../../model/ExerciseResult";
import { TestAttemptRecord } from "../../model/UserModuleProgress";
import { ExerciseStore } from "../../store/ExerciseStore";
import { ModuleTestAttemptStore } from "../../store/ModuleTestAttemptStore";
import { UserGrammarConceptProgressStore } from "../../store/UserGrammarConceptProgressStore";
import { UserModuleProgressStore } from "../../store/UserModuleProgressStore";
import { UserVocabularyProgressStore } from "../../store/UserVocabularyProgressStore";

/**
 * Finalises a Module Test attempt (F11).
 *
 * Steps:
 * 1. Load the attempt; validate it is in-progress.
 * 2. Compute the score: % of `exerciseIds` whose final `isCorrect` is true;
 *    unanswered exercises count as wrong.
 * 3. Determine pass/fail against `TEST_PASS_THRESHOLD`.
 * 4. Update mastery (F06) for every answered exercise — same loop as CompletePracticeSession.
 * 5. Persist the grading outcome on the attempt (`score`, `passed`, `takenAt`, `exerciseResults`).
 * 6. Record a TestAttemptRecord summary in `UserModuleProgress.testAttempts`.
 * 7. On pass: transition `UserModuleProgress` status to `completed`.
 */
export class SubmitModuleTest extends TotoDelegate<SubmitModuleTestRequest, SubmitModuleTestResponse> {

    /**
     * Extracts userId and attemptId from the route parameters.
     */
    parseRequest(req: Request): SubmitModuleTestRequest {

        const userId = req.params.userId;
        const attemptId = req.params.attemptId;

        if (!userId) throw new ValidationError(400, "userId is required");
        if (!attemptId) throw new ValidationError(400, "attemptId is required");

        return { userId, attemptId };
    }

    /**
     * Grades the attempt and performs all downstream effects (mastery, progress, module transition).
     */
    async do(req: SubmitModuleTestRequest, _userContext?: UserContext): Promise<SubmitModuleTestResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const attemptStore = new ModuleTestAttemptStore({ db, config });
        const attempt = await attemptStore.findById(req.attemptId);

        if (!attempt) throw new ValidationError(404, `Module test attempt ${req.attemptId} not found`);
        if (attempt.takenAt !== null) throw new ValidationError(400, "Attempt is already submitted");

        // Build an answer lookup for O(1) access
        const answerByExerciseId = new Map(attempt.answers.map(a => [a.exerciseId, a]));

        // Unanswered exercises count as wrong — iterate exerciseIds (not answers) as the source of truth
        const correctCount = attempt.exerciseIds.filter(id => answerByExerciseId.get(id)?.isCorrect === true).length;
        const score = attempt.exerciseIds.length > 0 ? Math.round((correctCount / attempt.exerciseIds.length) * 100) : 0;
        const passed = score >= TEST_PASS_THRESHOLD;
        const takenAt = new Date().toISOString();

        // Update mastery (F06) — bulk-fetch exercises to avoid N+1 queries
        const exerciseStore = new ExerciseStore(db);
        const exercises = await exerciseStore.findByIds(attempt.exerciseIds);
        const exerciseById = new Map(exercises.map(e => [e.id, e]));

        const vocabProgressStore = new UserVocabularyProgressStore({ db, config });
        const grammarProgressStore = new UserGrammarConceptProgressStore({ db, config });

        const exerciseResults: ExerciseResult[] = [];

        for (const answer of attempt.answers) {

            const exercise = exerciseById.get(answer.exerciseId);

            if (!exercise) continue;

            const result = new ExerciseResult({
                exerciseId: exercise.id,
                type: exercise.type,
                isCorrect: answer.isCorrect,
                userAnswer: answer.userAnswer,
                correctAnswer: exercise.answer,
                timestamp: answer.answeredAt,
                moduleId: attempt.moduleId,
            });

            exerciseResults.push(result);

            if (exercise.vocabularyItemId) {
                await vocabProgressStore.appendResultAndRecompute(req.userId, exercise.vocabularyItemId, result);
            } else if (exercise.grammarConceptId) {
                await grammarProgressStore.appendResultAndRecompute(req.userId, exercise.grammarConceptId, result);
            }
        }

        // Persist the grading outcome on the attempt
        await attemptStore.submit(req.attemptId, { score, passed, takenAt, exerciseResults });

        // Record summary in UserModuleProgress.testAttempts
        const progressStore = new UserModuleProgressStore({ db, config });

        await progressStore.appendTestAttempt(
            req.userId,
            attempt.moduleId,
            new TestAttemptRecord({ id: req.attemptId, score, passed, takenAt })
        );

        // On pass: transition module to completed
        if (passed) {
            await progressStore.transitionStatus(req.userId, attempt.moduleId, "completed");
        }

        return { score, passed };
    }
}

interface SubmitModuleTestRequest {
    userId: string;     // The user id
    attemptId: string;  // The module test attempt id
}

interface SubmitModuleTestResponse {
    score: number;      // Percentage correct (0–100)
    passed: boolean;    // Whether the attempt passed
}
