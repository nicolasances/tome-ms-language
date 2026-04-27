import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { VocabularyStore } from "../store/VocabularyStore";

export class PutWord extends TotoDelegate<PutWordRequest, PutWordResponse> {

    parseRequest(req: Request): PutWordRequest {
        const { id } = req.params;
        const { english, translation, knowledgeSource } = req.body;
        if (!english && !translation && knowledgeSource === undefined) {
            throw new ValidationError(400, "No updatable fields provided");
        }
        return { id, english, translation, knowledgeSource };
    }

    async do(req: PutWordRequest, userContext?: UserContext): Promise<PutWordResponse> {
        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const fields: { english?: string; translation?: string; knowledgeSource?: string } = {};
        
        if (req.english) fields.english = req.english;
        if (req.translation) fields.translation = req.translation;
        if (req.knowledgeSource) fields.knowledgeSource = req.knowledgeSource;

        const store = new VocabularyStore(db, config);
        const found = await store.updateWord(req.id, fields);

        if (!found) throw new ValidationError(404, `Word not found: ${req.id}`);

        return { id: req.id, updated: true };
    }
}

interface PutWordRequest {
    id: string;
    english?: string;
    translation?: string;
    knowledgeSource?: string;
}

interface PutWordResponse {
    id: string;
    updated: boolean;
}
