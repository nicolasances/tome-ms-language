import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { VocabularyStore } from "../store/VocabularyStore";
import { SUPPORTED_LANGUAGES } from "../util/Languages";

export class RemoveWordAlternative extends TotoDelegate<RemoveWordAlternativeRequest, RemoveWordAlternativeResponse> {

    parseRequest(req: Request): RemoveWordAlternativeRequest {
        const language = req.params.language;
        if (!SUPPORTED_LANGUAGES.includes(language)) throw new ValidationError(400, `Unsupported language: ${language}`);
        return { language, wordId: req.params.wordId, altId: req.params.id };
    }

    async do(req: RemoveWordAlternativeRequest, userContext?: UserContext): Promise<RemoveWordAlternativeResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        
        const store = new VocabularyStore(db, config);
        
        const found = await store.removeAlternative(req.wordId, req.altId);
        
        if (!found) throw new ValidationError(404, `Word not found: ${req.wordId}`);
        
        return { id: req.altId, removed: true };
    }
}

interface RemoveWordAlternativeRequest {
    language: string;
    wordId: string;
    altId: string;
}

interface RemoveWordAlternativeResponse {
    id: string;
    removed: boolean;
}
