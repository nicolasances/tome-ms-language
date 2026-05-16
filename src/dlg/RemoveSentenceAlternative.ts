import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { SentenceStore } from "../store/SentenceStore";
import { SUPPORTED_LANGUAGES } from "../util/Languages";

export class RemoveSentenceAlternative extends TotoDelegate<RemoveSentenceAlternativeRequest, RemoveSentenceAlternativeResponse> {

    parseRequest(req: Request): RemoveSentenceAlternativeRequest {
        const language = req.params.language;
        if (!SUPPORTED_LANGUAGES.includes(language)) throw new ValidationError(400, `Unsupported language: ${language}`);
        return { language, sentenceId: req.params.sentenceId, altId: req.params.id };
    }

    async do(req: RemoveSentenceAlternativeRequest, userContext?: UserContext): Promise<RemoveSentenceAlternativeResponse> {
        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        const store = new SentenceStore(db, config);
        const found = await store.removeAlternative(req.sentenceId, req.altId);
        if (!found) throw new ValidationError(404, `Sentence not found: ${req.sentenceId}`);
        return { id: req.altId, removed: true };
    }
}

interface RemoveSentenceAlternativeRequest {
    language: string;
    sentenceId: string;
    altId: string;
}

interface RemoveSentenceAlternativeResponse {
    id: string;
    removed: boolean;
}
