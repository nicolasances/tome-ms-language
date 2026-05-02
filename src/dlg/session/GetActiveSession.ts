import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { SessionsStore } from "../../store/SessionsStore";

export class GetActiveSession extends TotoDelegate<GetActiveSessionRequest, GetActiveSessionResponse> {

    parseRequest(_req: Request): GetActiveSessionRequest {
        return {};
    }

    async do(_req: GetActiveSessionRequest, userContext?: UserContext): Promise<GetActiveSessionResponse> {
        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        const userId = userContext!.userId;

        const store = new SessionsStore({ db, config });
        const session = await store.findActiveSession({ userId });

        if (!session) throw new ValidationError(404, "No active session found");

        return {
            sessionId: session.id!,
            language: session.language,
            practiceType: session.practiceType,
            payload: {
                words: session.payload.words,
                totalWords: session.payload.totalWords,
            },
        };
    }
}

interface GetActiveSessionRequest {}

interface GetActiveSessionResponse {
    sessionId: string;
    language: string;
    practiceType: string;
    payload: {
        words: Array<{ wordId: string; english: string; translation: string }>;
        totalWords: number;
    };
}
