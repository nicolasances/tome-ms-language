import { APIOptions, TotoControllerConfig } from 'totoms';

/**
 * Minimum % of each practice session (Step 2) reserved for vocabulary items the user
 * has not yet encountered in the module. Guarantees full vocabulary coverage is reached
 * within a bounded number of sessions (see F03/F10).
 *
 * This is a microservice-level tuning constant, not a per-module persisted field.
 */
export const PRACTICE_MIN_UNSEEN_VOCAB_PERCENT = 50;

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
