import { Db } from "mongodb";
import { ControllerConfig, PROFICIENCY_RUNG_WEIGHTS, PROFICIENCY_TEST_BLEND_WEIGHT, PROFICIENCY_TEST_ERROR_WEIGHT, PROFICIENCY_VERSION } from "../Config";
import { Exercise } from "../model/Exercise";
import { ModuleTestAttempt } from "../model/ModuleTestAttempt";
import { PracticeSession } from "../model/PracticeSession";
import { ModuleProficiency, ProficiencyBasis } from "../model/UserModuleProgress";
import { ExerciseStore } from "../store/ExerciseStore";
import { ModuleTestAttemptStore } from "../store/ModuleTestAttemptStore";
import { PracticeSessionStore } from "../store/PracticeSessionStore";
import { rungOfType } from "./PracticeRungs";

/**
 * The User Proficiency Score (UPS): a 0–100 per-user, per-module measure of **how hard the module
 * actually was**, computed once when the module is completed.
 *
 * Both components share one formula — `100 × correct / (correct + k × wrong)` — differing only in
 * how heavily a wrong answer is charged: k = 1 for practice (plain accuracy over every answer,
 * retries included), k = PROFICIENCY_TEST_ERROR_WEIGHT for the test. A correct answer adds 1 to
 * both numerator and denominator; a wrong one adds k to the denominator only. The weighting is
 * applied **inside each source's own ratio, before the blend** — pooling every answer into one
 * global ratio would let the ~300 practice answers drown the 20 test questions.
 */

/**
 * Rounds a score to one decimal place — the precision the UPS and its two components are reported at.
 *
 * @param {number} value - The raw score.
 *
 * @returns {number} The score rounded to one decimal.
 */
function roundScore(value: number): number {

    return Math.round(value * 10) / 10;
}

/**
 * Computes the test component of the UPS from a submitted Module Test attempt, charging every
 * wrong answer PROFICIENCY_TEST_ERROR_WEIGHT times what a correct one is worth.
 *
 * Consistent with F11's scoring rule, `exerciseIds` — not `answers` — is the source of truth: an
 * exercise that was never answered counts as wrong. F13 verification has already flipped
 * `isCorrect` on the attempt by this point, so no extra discount applies here.
 *
 * @param {ModuleTestAttempt} attempt - The submitted attempt to score.
 *
 * @returns {number} The test score (0–100); 0 when the attempt holds no exercises.
 */
export function computeTestScore(attempt: ModuleTestAttempt): number {

    const correctByExerciseId = new Map(attempt.answers.map(a => [a.exerciseId, a.isCorrect]));

    const correctCount = attempt.exerciseIds.filter(id => correctByExerciseId.get(id) === true).length;
    const wrongCount = attempt.exerciseIds.length - correctCount;

    const denominator = correctCount + PROFICIENCY_TEST_ERROR_WEIGHT * wrongCount;

    if (denominator === 0) return 0;

    return roundScore(100 * correctCount / denominator);
}

/**
 * Computes the practice component of the UPS: rung-weighted accuracy over every answer submitted
 * across the given completed practice sessions.
 *
 * Rules:
 * - Answers are **pooled per rung across all sessions**, not averaged per session, so a short
 *   final session does not count as much as a long stretch of them.
 * - The rung is resolved **per answer** from the exercise's type, never per session, so pre-ladder
 *   sessions that mixed types still split correctly across rungs.
 * - Rung 1 carries weight 0 (see PROFICIENCY_RUNG_WEIGHTS) and therefore drops out entirely.
 * - Because a completed session ends with one correct answer per exercise, the retries **are** the
 *   surplus: an item fought over five times costs five times an item missed once.
 * - **F13-verified misses are discounted.** In practice F13 accepts a disputed answer without
 *   flipping `isCorrect` — it only records the exercise on `verifiedExerciseIds`. For such an
 *   exercise the *first* wrong answer of that session is treated as correct, matching the module
 *   test, where the same AI ruling flips `isCorrect` before the score is computed.
 *
 * @param {PracticeSession[]} sessions - The completed sessions to score.
 * @param {Map<string, Exercise>} exercisesById - The exercises the answers point at, keyed by id.
 *
 * @returns {number | null} The practice score (0–100), or null when no answer belongs to a weighted rung.
 */
export function computePracticeScore(sessions: PracticeSession[], exercisesById: Map<string, Exercise>): number | null {

    let weightedCorrect = 0;
    let weightedTotal = 0;

    for (const session of sessions) {

        const verifiedExerciseIds = new Set(session.verifiedExerciseIds);
        const pardonedExerciseIds = new Set<string>();

        for (const answer of session.answers) {

            const exercise = exercisesById.get(answer.exerciseId);

            if (!exercise) continue;

            const rung = rungOfType(exercise.type);
            const weight = rung !== null ? (PROFICIENCY_RUNG_WEIGHTS[rung] ?? 0) : 0;

            if (weight === 0) continue;

            // The AI accepted this answer even though the matcher did not — pardon it, once.
            const isPardoned = !answer.isCorrect && verifiedExerciseIds.has(answer.exerciseId) && !pardonedExerciseIds.has(answer.exerciseId);

            if (isPardoned) pardonedExerciseIds.add(answer.exerciseId);

            weightedTotal += weight;
            if (answer.isCorrect || isPardoned) weightedCorrect += weight;
        }
    }

    if (weightedTotal === 0) return null;

    return roundScore(100 * weightedCorrect / weightedTotal);
}

/**
 * Resolves which inputs the score could be computed from, so a test-only score is never mistaken
 * for a genuine flawless practice run.
 *
 * @param {PracticeSession[]} sessions - The completed practice sessions.
 * @param {Map<string, Exercise>} exercisesById - The exercises the answers point at, keyed by id.
 * @param {number | null} practiceScore - The practice component, or null when there is none.
 *
 * @returns {ProficiencyBasis} The basis label.
 */
function resolveBasis(sessions: PracticeSession[], exercisesById: Map<string, Exercise>, practiceScore: number | null): ProficiencyBasis {

    if (practiceScore === null) return "test-only";

    const rungsAnswered = new Set<number>();

    for (const session of sessions) {
        for (const answer of session.answers) {

            const exercise = exercisesById.get(answer.exerciseId);

            if (!exercise) continue;

            const rung = rungOfType(exercise.type);

            if (rung !== null && (PROFICIENCY_RUNG_WEIGHTS[rung] ?? 0) > 0) rungsAnswered.add(rung);
        }
    }

    if (rungsAnswered.size > 1) return "full";

    return rungsAnswered.has(3) ? "practice-rung3-only" : "practice-rung2-only";
}

/**
 * Blends the two components into the UPS and packages the result.
 *
 * The test component carries PROFICIENCY_TEST_BLEND_WEIGHT of the score and practice the
 * remainder. When there is no practice component at all the UPS falls back to the test score
 * alone rather than renormalising against invented data.
 *
 * @param {BuildProficiencyInput} input - The first submitted test attempt, the completed practice sessions, the exercises those answers point at, and the computation timestamp.
 *
 * @returns {ModuleProficiency} The computed score.
 */
export function buildProficiency(input: BuildProficiencyInput): ModuleProficiency {

    const testScore = computeTestScore(input.attempt);
    const practiceScore = computePracticeScore(input.sessions, input.exercisesById);
    const basis = resolveBasis(input.sessions, input.exercisesById, practiceScore);

    const score = practiceScore === null
        ? testScore
        : roundScore(PROFICIENCY_TEST_BLEND_WEIGHT * testScore + (1 - PROFICIENCY_TEST_BLEND_WEIGHT) * practiceScore);

    return new ModuleProficiency({ score, testScore, practiceScore, basis, computedAt: input.computedAt, version: PROFICIENCY_VERSION, passNumber: input.passNumber });
}

/**
 * Loads everything the UPS is derived from and computes it: the given pass's (F25) first
 * submitted Module Test attempt, the practice sessions of that pass completed before the module
 * was completed, and the exercises those answers point at (one bulk read, never one per answer).
 *
 * @param {ComputeModuleProficiencyInput} input - The db handle, service config, user + module to score, the pass to score, and the module's completion timestamp.
 *
 * @returns {Promise<ModuleProficiency | null>} The computed score, or null when the user has no submitted test attempt for that pass — without one there is nothing to score.
 */
export async function computeModuleProficiency(input: ComputeModuleProficiencyInput): Promise<ModuleProficiency | null> {

    const { db, config, userId, moduleId, passNumber, completedAt } = input;

    const attempt = await new ModuleTestAttemptStore({ db, config }).findFirstSubmittedByUserAndModule(userId, moduleId, passNumber);

    if (!attempt) return null;

    const sessions = await new PracticeSessionStore({ db, config }).listCompletedByUserAndModule(userId, moduleId, passNumber, completedAt);

    const answeredExerciseIds = [...new Set(sessions.flatMap(s => s.answers.map(a => a.exerciseId)))];

    const exercises = await new ExerciseStore(db).findByIds(answeredExerciseIds);

    return buildProficiency({ attempt, sessions, exercisesById: new Map(exercises.map(e => [e.id, e])), computedAt: new Date().toISOString(), passNumber });
}

export interface BuildProficiencyInput {
    attempt: ModuleTestAttempt;                 // The user's first submitted Module Test attempt for the pass being scored.
    sessions: PracticeSession[];                // The practice sessions of that pass completed before the module was completed.
    exercisesById: Map<string, Exercise>;       // The exercises the practice answers point at, keyed by id.
    computedAt: string;                         // ISO-8601 timestamp to stamp on the score.
    passNumber?: number;                        // The pass this score was computed from (F25). Defaults to 1.
}

export interface ComputeModuleProficiencyInput {
    db: Db;                                     // The mongo database handle.
    config: ControllerConfig;                   // The service config.
    userId: string;                             // The user to score.
    moduleId: string;                           // The module to score.
    passNumber: number;                         // The pass (F25) to score — only this pass's sessions and attempt count.
    completedAt?: string;                       // ISO-8601 timestamp of when the module was completed; upper-bounds the practice sessions that count. Absent on a legacy record that carries no completion timestamp, in which case every completed session counts.
}
