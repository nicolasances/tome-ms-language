import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { VocabularyStore } from "../store/VocabularyStore";
import { SUPPORTED_LANGUAGES } from "../util/Languages";

export class AddWordAlternative extends TotoDelegate<AddWordAlternativeRequest, AddWordAlternativeResponse> {

    parseRequest(req: Request): AddWordAlternativeRequest {

        const language = req.params.language;
        const translation = req.body?.translation;
        
        if (!SUPPORTED_LANGUAGES.includes(language)) throw new ValidationError(400, `Unsupported language: ${language}`);
        if (!translation) throw new ValidationError(400, "translation is required");
        
        return { language, wordId: req.params.wordId, translation };
    }

    async do(req: AddWordAlternativeRequest, userContext?: UserContext): Promise<AddWordAlternativeResponse> {
        
        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        
        const store = new VocabularyStore(db, config);
        
        const result = await store.addAlternative(req.wordId, req.translation);
        
        if (!result) throw new ValidationError(404, `Word not found: ${req.wordId}`);
        
        return result;
    }
}

interface AddWordAlternativeRequest {
    language: string;
    wordId: string;
    translation: string;
}

interface AddWordAlternativeResponse {
    id: string;
    translation: string;
}
