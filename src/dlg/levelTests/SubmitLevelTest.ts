import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig, LEVEL_TEST_PASS_THRESHOLD } from "../../Config";
import { nextLevel } from "../../model/CefrLevels";
import { ExerciseResult } from "../../model/ExerciseResult";
import { ExerciseStore } from "../../store/ExerciseStore";
import { LevelTestAttemptStore } from "../../store/LevelTestAttemptStore";
import { UserGrammarConceptProgressStore } from "../../store/UserGrammarConceptProgressStore";
import { UserStore } from "../../store/UserStore";
import { UserVocabularyProgressStore } from "../../store/UserVocabularyProgressStore";

/**
 * Finalises a Level Test attempt (F21).
 *
 * Steps:
 * 1. Load the attempt; validate it is in-progress.
 * 2. Compute the score: % of `exerciseIds` whose final `isCorrect` is true; unanswered count as wrong.
 * 3. Determine pass/fail against `LEVEL_TEST_PASS_THRESHOLD` (75%).
 * 4. Update mastery (F06) for every answered exercise — same loop as the module test.
 * 5. Persist the grading outcome on the attempt (`score`, `passed`, `takenAt`, `exerciseResults`).
 * 6. On pass: advance the user's CEFR level (F05) — no-op if already at the highest level.
 */
export class SubmitLevelTest extends TotoDelegate<SubmitLevelTestRequest, SubmitLevelTestResponse> {

    /**
     * Extracts userId and attemptId from the route parameters.
     */
    parseRequest(req: Request): SubmitLevelTestRequest {

        const userId = req.params.userId;
        const attemptId = req.params.attemptId;

        if (!userId) throw new ValidationError(400, "userId is required");
        if (!attemptId) throw new ValidationError(400, "attemptId is required");

        return { userId, attemptId };
    }

    /**
     * Grades the attempt and performs all downstream effects (mastery, persistence, level advance).
     *
     * @param {SubmitLevelTestRequest} req - The userId and attemptId.
     *
     * @returns {Promise<SubmitLevelTestResponse>} The score, pass verdict, and the level advanced to (if any).
     */
    async do(req: SubmitLevelTestRequest, _userContext?: UserContext): Promise<SubmitLevelTestResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const attemptStore = new LevelTestAttemptStore({ db, config });
        const attempt = await attemptStore.findById(req.attemptId);

        if (!attempt) throw new ValidationError(404, `Level test attempt ${req.attemptId} not found`);
        if (attempt.takenAt !== null) throw new ValidationError(400, "Attempt is already submitted");

        // Unanswered exercises count as wrong — iterate exerciseIds (not answers) as the source of truth
        const answerByExerciseId = new Map(attempt.answers.map(a => [a.exerciseId, a]));

        const correctCount = attempt.exerciseIds.filter(id => answerByExerciseId.get(id)?.isCorrect === true).length;
        const score = attempt.exerciseIds.length > 0 ? Math.round((correctCount / attempt.exerciseIds.length) * 100) : 0;
        const passed = score >= LEVEL_TEST_PASS_THRESHOLD;
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
                moduleId: exercise.moduleId,
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

        // On pass: advance the user's CEFR level (F05). No-op if already at the highest level.
        let advancedTo: string | null = null;

        if (passed) {

            const userStore = new UserStore({ db, config });
            const user = await userStore.findById(req.userId);

            if (user) {

                const next = nextLevel(user.cefrLevel);

                if (next) {
                    await userStore.updateCefrLevel(user.email, next);
                    advancedTo = next;
                }
            }
        }

        return { score, passed, advancedTo };
    }
}

interface SubmitLevelTestRequest {
    userId: string;     // The user id
    attemptId: string;  // The level test attempt id
}

interface SubmitLevelTestResponse {
    score: number;              // Percentage correct (0–100)
    passed: boolean;            // Whether the attempt passed (score >= 75%)
    advancedTo: string | null;  // The CEFR level the user was promoted to on a pass; null if none
}
