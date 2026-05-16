import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { VocabularyStore } from "../store/VocabularyStore";
import { SUPPORTED_LANGUAGES } from "../util/Languages";

export class GetWord extends TotoDelegate<GetWordRequest, GetWordResponse> {

    parseRequest(req: Request): GetWordRequest {
        const language = req.params.language;
        if (!SUPPORTED_LANGUAGES.includes(language)) throw new ValidationError(400, `Unsupported language: ${language}`);
        return { language, wordId: req.params.wordId };
    }

    async do(req: GetWordRequest, userContext?: UserContext): Promise<GetWordResponse> {
        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        const store = new VocabularyStore(db, config);
        const word = await store.findById(req.wordId);
        if (!word) throw new ValidationError(404, `Word not found: ${req.wordId}`);
        return { id: word.id!, language: word.language, english: word.english, translation: word.translation, createdAt: word.createdAt, knowledgeSource: word.knowledgeSource, alternativeTranslations: word.alternativeTranslations };
    }
}

interface GetWordRequest {
    language: string;
    wordId: string;
}

interface GetWordResponse {
    id: string;
    language: string;
    english: string;
    translation: string;
    createdAt: string;
    knowledgeSource: string;
    alternativeTranslations: Array<{ id: string; translation: string }>;
}
