import { APIOptions, TotoControllerConfig } from 'totoms';

/**
 * Minimum % of each practice session (Step 2) reserved for vocabulary items the user
 * has not yet encountered in the module. Guarantees full vocabulary coverage is reached
 * within a bounded number of sessions (see F03/F10).
 *
 * This is a microservice-level tuning constant, not a per-module persisted field.
 */
export const PRACTICE_MIN_UNSEEN_VOCAB_PERCENT = 50;

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

export class ControllerConfig extends TotoControllerConfig {

    getMongoSecretNames(): { userSecretName: string; pwdSecretName: string; } | null {

        return {
            userSecretName: "tome-ms-language-mongo-user",
            pwdSecretName: "tome-ms-language-mongo-pswd",
        };

    }

    public getDBName() {
        return "tomelang";
    }

    getProps(): APIOptions {
        return {}
    }

}
