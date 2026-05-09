import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { SentenceSessionPayload, VocabularySessionPayload } from "../../model/Session";
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

        if (session.practiceType === "vocabulary") {
            const vocabPayload = session.payload as VocabularySessionPayload;
            return {
                sessionId: session.id!,
                language: session.language,
                practiceType: session.practiceType,
                payload: {
                    words: vocabPayload.words,
                    totalWords: vocabPayload.totalWords,
                },
            };
        }

        // sentences
        const sentencePayload = session.payload as SentenceSessionPayload;
        return {
            sessionId: session.id!,
            language: session.language,
            practiceType: session.practiceType,
            payload: {
                sentences: sentencePayload.sentences,
                totalSentences: sentencePayload.totalSentences,
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
        words?: Array<{ wordId: string; english: string; translation: string }>;
        totalWords?: number;
        sentences?: Array<{ sentenceId: string; sentence: string; translation: string }>;
        totalSentences?: number;
    };
}
