import { APIOptions, TotoControllerConfig } from 'totoms';

/**
 * Minimum % of each practice session (Step 2) reserved for practice items the user has not yet
 * covered **at the module's current rung**. Guarantees a rung phase completes within a bounded
 * number of sessions (see F10).
 *
 * This is a microservice-level tuning constant, not a per-module persisted field.
 */
export const PRACTICE_MIN_UNSEEN_VOCAB_PERCENT = 50;

/**
 * The practice ladder (F10): the difficulty tier each exercise type belongs to.
 *
 * 1 · Recognition      — select or assemble from provided material
 * 2 · Cued production  — produce a form, heavily constrained by context
 * 3 · Free production  — produce from meaning alone
 *
 * `sentence_reorder` sits at rung 1 on purpose: the word tiles are supplied, so it is assembly,
 * not production. `fill_blank` and `translation_active` carry both the vocabulary and the grammar
 * side of their rung — see FLEXIBLE_LINKED_TYPES in the Exercise model.
 *
 * The rung is derived from the type; it is never stored on the exercise.
 */
export const PRACTICE_RUNG_TYPES: Record<number, readonly string[]> = {
    1: ["multiple_choice", "sentence_reorder"],
    2: ["fill_blank", "conjugation_drill"],
    3: ["translation_active", "error_correction"],
};

/**
 * The rung a module's practice starts at (F10).
 */
export const FIRST_PRACTICE_RUNG = 1;

/**
 * The last rung of the ladder. Completing it sets `practiceCompletedAt` and starts the
 * module test unlock countdown (F11).
 */
export const LAST_PRACTICE_RUNG = 3;

/**
 * Minimum % of exercises in a Module Test (F11) that must be of type `translation_active`.
 * Applied as a hard floor using the split-selection pattern: F08 is called first on the
 * translation_active-only pool to fill this share, then on the remaining pool for the rest.
 * If the translation_active pool is smaller than the floor, all available ones are used
 * (graceful cap — no hard failure).
 */
export const MODULE_TEST_MIN_TRANSLATION_ACTIVE_PERCENT = 60;

/**
 * Mastery score above which an exercise's linked item is considered mastered
 * and the exercise is deprioritized during selection (F08), unless the pool
 * of non-deprioritized exercises is too small to fill the session.
 */
export const DEPRIORITIZE_MASTERY_THRESHOLD = 0.85;

/**
 * Extra weight added to an exercise's selection weight (F08) when its linked
 * item was answered incorrectly in the user's most recent session, so it
 * resurfaces sooner.
 */
export const RECENT_MISS_BOOST = 0.5;

/**
 * Number of questions drawn for each Module Test (F11).
 * Fixed at 20 in v2.0.
 */
export const MODULE_TEST_SIZE = 20;

/**
 * Hours after Step 2 completion (`practiceCompletedAt`) before a Module Test
 * is unlocked (F11). Enforces the spaced-repetition gap between practice and
 * assessment.
 */
export const TEST_UNLOCK_DELAY_HOURS = 4;

/**
 * Minimum percentage of correct answers required to pass a Module Test (F11).
 * Expressed as a value between 0 and 100.
 */
export const TEST_PASS_THRESHOLD = 80;

/**
 * Minutes after a failed Module Test's `takenAt` timestamp before the user
 * may start a retry attempt (F11).
 */
export const TEST_RETRY_DELAY_MINUTES = 20;

/**
 * Number of questions drawn for each Level Test (F21).
 * Fixed at 40 in v2.0.
 */
export const LEVEL_TEST_SIZE = 40;

/**
 * Minimum percentage of correct answers required to pass a Level Test (F21).
 * Expressed as a value between 0 and 100. Lower than the Module Test (80%).
 */
export const LEVEL_TEST_PASS_THRESHOLD = 75;

/**
 * Minutes that must elapse after the most recent submitted Level Test attempt's
 * `takenAt` timestamp before the user may start a new attempt at the same level (F21).
 * This is the inter-attempt cooldown.
 */
export const LEVEL_TEST_RETRY_DELAY_MINUTES = 30;

/**
 * Version of the User Proficiency Score (UPS) formula. Stored on every computed
 * `UserModuleProgress.proficiency`; a stored score carrying a lower version is recomputed the next
 * time `GET /me/progress` reads it. Bumping this constant is how a change to the weights below is
 * rolled out — there is no hand-run migration.
 */
export const PROFICIENCY_VERSION = 1;

/**
 * How much a wrong answer in the Module Test is charged, relative to what a correct one is worth,
 * when computing the UPS test component: `100 × C / (C + k × W)`.
 *
 * The test is taken *after* the whole practice ladder is complete, so an error there is far more
 * diagnostic than an error during practice, where being wrong is the expected path to learning.
 * At k = 3 the formula is convex: the first slip costs ~2.7× what it would under plain accuracy,
 * and each subsequent one costs less.
 */
export const PROFICIENCY_TEST_ERROR_WEIGHT = 3;

/**
 * Share of the UPS carried by the test component; the practice component carries the remainder.
 *
 * Deliberately not test-heavier: PROFICIENCY_TEST_ERROR_WEIGHT already penalises test errors, and
 * stacking a 75/25 blend on top would apply the same penalty twice.
 */
export const PROFICIENCY_TEST_BLEND_WEIGHT = 0.6;

/**
 * Weight each practice-ladder rung carries in the UPS practice component.
 *
 * Rung 1 (recognition) is excluded entirely — selecting from provided material says little about
 * proficiency. Rung 3 (free production) counts double rung 2 (cued production), so normalised the
 * two contribute ⅓ and ⅔ of the component respectively.
 */
export const PROFICIENCY_RUNG_WEIGHTS: Record<number, number> = { 1: 0, 2: 1, 3: 2 };

/**
 * IANA timezone used as the single reference civil-day boundary for F24 activity bucketing.
 * All per-day counts bucket timestamps into this timezone — not UTC, not per-user.
 */
export const REFERENCE_TIMEZONE = 'Europe/Copenhagen';

export class ControllerConfig extends TotoControllerConfig {

    getMongoSecretNames(): { userSecretName: string; pwdSecretName: string; } | null {

        return {
            userSecretName: "tome-ms-language-mongo-user",
            pwdSecretName: "tome-ms-language-mongo-pswd",
        };

    }

    /**
     * Lists every Mongo collection currently in use by this service.
     *
     * Backs `POST /backup`: each collection returned here is dumped in full and uploaded to
     * `BACKUP_BUCKET`. There is no auto-discovery mechanism — a collection added later must be
     * added here explicitly, or it silently falls out of the backup.
     *
     * @returns {string[]} the names of all backed-up collections
     */
    public getCollections(): string[] {

        return [
            "exercises",
            "grammar",
            "modules",
            "levelTestBanks",
            "levelTestAttempts",
            "moduleTestAttempts",
            "practiceSessions",
            "userGrammarProgress",
            "userModuleProgress",
            "userVocabularyProgress",
            "users",
            "vocabulary",
        ];

    }

    public getDBName() {
        return "tomelang";
    }

    getProps(): APIOptions {
        return {}
    }

    getMongoHost(): string | null {
        return this.mongoHost || null;
    }

}
