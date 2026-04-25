import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { VocabularyStore } from "../store/VocabularyStore";

export class PutWord extends TotoDelegate<PutWordRequest, PutWordResponse> {

    parseRequest(req: Request): PutWordRequest {
        const { id } = req.params;
        const { english, translation } = req.body;
        if (!english && !translation) {
            throw new ValidationError(400, "No updatable fields provided");
        }
        return { id, english, translation };
    }

    async do(req: PutWordRequest, userContext?: UserContext): Promise<PutWordResponse> {
        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const fields: { english?: string; translation?: string } = {};
        if (req.english) fields.english = req.english;
        if (req.translation) fields.translation = req.translation;

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
}

interface PutWordResponse {
    id: string;
    updated: boolean;
}
