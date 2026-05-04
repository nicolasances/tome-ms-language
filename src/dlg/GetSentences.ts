import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { SentenceStore } from "../store/SentenceStore";
import { SUPPORTED_LANGUAGES } from "../util/Languages";

export class GetSentences extends TotoDelegate<GetSentencesRequest, GetSentencesResponse> {

    parseRequest(req: Request): GetSentencesRequest {
        const language = req.params.language;
        if (!SUPPORTED_LANGUAGES.includes(language)) {
            throw new ValidationError(400, `Unsupported language: ${language}`);
        }
        return { language };
    }

    async do(req: GetSentencesRequest, userContext?: UserContext): Promise<GetSentencesResponse> {
        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        const store = new SentenceStore(db, config);

        const sentences = await store.findByLanguage(req.language);

        return {
            language: req.language,
            sentences: sentences.map(s => ({
                id: s.id!,
                sentence: s.sentence,
                translation: s.translation,
                createdAt: s.createdAt,
                knowledgeSource: s.knowledgeSource,
            })),
        };
    }
}

interface GetSentencesRequest {
    language: string;
}

interface GetSentencesResponse {
    language: string;
    sentences: Array<{
        id: string;
        sentence: string;
        translation: string;
        createdAt: string;
        knowledgeSource: string;
    }>;
}
