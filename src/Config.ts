import { APIOptions, TotoControllerConfig } from 'totoms';

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

    get sessionWordCount(): number {
        return parseInt(process.env.SESSION_WORD_COUNT ?? "10", 10);
    }

    get defaultFailureRatio(): number {
        return parseFloat(process.env.DEFAULT_FAILURE_RATIO ?? "0.5");
    }

}
