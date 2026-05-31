import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { VocabularyItemStore } from "../store/VocabularyItemStore";

export class GetVocabularyItem extends TotoDelegate<GetVocabularyItemRequest, GetVocabularyItemResponse> {

    parseRequest(req: Request): GetVocabularyItemRequest {

        const id = req.params.id;

        if (!id) throw new ValidationError(400, "id is required");

        return { id };
    }

    async do(req: GetVocabularyItemRequest, _userContext?: UserContext): Promise<GetVocabularyItemResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const store = new VocabularyItemStore(db);
        const item = await store.findById(req.id);

        if (!item) throw new ValidationError(404, `Vocabulary item '${req.id}' not found`);

        return {
            id: item.id,
            danish: item.danish,
            english: item.english,
            type: item.type,
            context: item.context,
            tags: item.tags,
            cefrLevel: item.cefrLevel,
            source: item.source,
            addedByUserId: item.addedByUserId,
        };
    }
}

interface GetVocabularyItemRequest {
    id: string;
}

interface GetVocabularyItemResponse {
    id: string;
    danish: string;
    english: string;
    type: string;
    context: string | null;
    tags: string[];
    cefrLevel: string;
    source: string;
    addedByUserId: string | null;
}
