import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { SentenceStore } from "../store/SentenceStore";
import { SUPPORTED_LANGUAGES } from "../util/Languages";

export class GetSentence extends TotoDelegate<GetSentenceRequest, GetSentenceResponse> {

    parseRequest(req: Request): GetSentenceRequest {
        
        const language = req.params.language;
        
        if (!SUPPORTED_LANGUAGES.includes(language)) throw new ValidationError(400, `Unsupported language: ${language}`);
        
        return { language, sentenceId: req.params.sentenceId };
    }

    async do(req: GetSentenceRequest, userContext?: UserContext): Promise<GetSentenceResponse> {
        
        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        
        const store = new SentenceStore(db, config);
        
        const sentence = await store.findById(req.sentenceId);
        
        if (!sentence) throw new ValidationError(404, `Sentence not found: ${req.sentenceId}`);
        
        return { id: sentence.id!, language: sentence.language, sentence: sentence.sentence, translation: sentence.translation, createdAt: sentence.createdAt, knowledgeSource: sentence.knowledgeSource, alternativeTranslations: sentence.alternativeTranslations };
    }
}

interface GetSentenceRequest {
    language: string;
    sentenceId: string;
}

interface GetSentenceResponse {
    id: string;
    language: string;
    sentence: string;
    translation: string;
    createdAt: string;
    knowledgeSource: string;
    alternativeTranslations: Array<{ id: string; translation: string }>;
}
