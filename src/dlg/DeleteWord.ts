import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { VocabularyStore } from "../store/VocabularyStore";

export class DeleteWord extends TotoDelegate<DeleteWordRequest, DeleteWordResponse> {

    parseRequest(req: Request): DeleteWordRequest {
        return { id: req.params.id };
    }

    async do(req: DeleteWordRequest, userContext?: UserContext): Promise<DeleteWordResponse> {
        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const store = new VocabularyStore(db, config);
        const deleted = await store.deleteWord(req.id);

        if (!deleted) throw new ValidationError(404, `Word not found: ${req.id}`);

        return { id: req.id, deleted: true };
    }
}

interface DeleteWordRequest {
    id: string;
}

interface DeleteWordResponse {
    id: string;
    deleted: boolean;
}
