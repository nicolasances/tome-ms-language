import { APIOptions, TotoControllerConfig } from 'totoms';

export class ControllerConfig extends TotoControllerConfig {

    getMongoSecretNames(): { userSecretName: string; pwdSecretName: string; } | null {

        return {
            userSecretName: "tome-ms-language-mongo-user",
            pwdSecretName: "tome-ms-language-mongo-pswd",
        };

    }

    getProps(): APIOptions {
        return {}
    }

}
