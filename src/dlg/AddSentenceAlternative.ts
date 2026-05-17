import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { SentenceStore } from "../store/SentenceStore";
import { SUPPORTED_LANGUAGES } from "../util/Languages";

export class AddSentenceAlternative extends TotoDelegate<AddSentenceAlternativeRequest, AddSentenceAlternativeResponse> {

    parseRequest(req: Request): AddSentenceAlternativeRequest {
        
        const language = req.params.language;
        const translation = req.body?.translation;
        
        if (!SUPPORTED_LANGUAGES.includes(language)) throw new ValidationError(400, `Unsupported language: ${language}`);
        if (!translation) throw new ValidationError(400, "translation is required");
        
        return { language, sentenceId: req.params.sentenceId, translation };
    }

    async do(req: AddSentenceAlternativeRequest, userContext?: UserContext): Promise<AddSentenceAlternativeResponse> {
        
        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        
        const store = new SentenceStore(db, config);
        
        const result = await store.addAlternative(req.sentenceId, req.translation);
        
        if (!result) throw new ValidationError(404, `Sentence not found: ${req.sentenceId}`);
        
        return result;
    }
}

interface AddSentenceAlternativeRequest {
    language: string;
    sentenceId: string;
    translation: string;
}

interface AddSentenceAlternativeResponse {
    id: string;
    translation: string;
}
