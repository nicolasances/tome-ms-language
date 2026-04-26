import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { VocabularyStore } from "../store/VocabularyStore";
import { SUPPORTED_LANGUAGES } from "../util/Languages";

export class GetVocabulary extends TotoDelegate<GetVocabularyRequest, GetVocabularyResponse> {

    parseRequest(req: Request): GetVocabularyRequest {
        const language = req.params.language;
        if (!SUPPORTED_LANGUAGES.includes(language)) {
            throw new ValidationError(400, `Unsupported language: ${language}`);
        }
        return { language };
    }

    async do(req: GetVocabularyRequest, userContext?: UserContext): Promise<GetVocabularyResponse> {
        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const store = new VocabularyStore(db, config);
        const words = await store.findByLanguage(req.language);

        return {
            language: req.language,
            words: words.map(w => ({
                id: w.id!,
                english: w.english,
                translation: w.translation,
                createdAt: w.createdAt,
                knowledgeSource: w.knowledgeSource,
            })),
        };
    }
}

interface GetVocabularyRequest {
    language: string;
}

interface GetVocabularyResponse {
    language: string;
    words: Array<{
        id: string;
        english: string;
        translation: string;
        createdAt: string;
        knowledgeSource?: string;
    }>;
}
