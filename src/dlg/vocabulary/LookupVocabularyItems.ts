import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { VocabularyItem } from "../../model/VocabularyItem";
import { VocabularyItemStore } from "../../store/VocabularyItemStore";

export class LookupVocabularyItems extends TotoDelegate<LookupVocabularyItemsRequest, LookupVocabularyItemsResponse> {

    parseRequest(req: Request): LookupVocabularyItemsRequest {

        const { ids } = req.body ?? {};

        if (!ids || !Array.isArray(ids) || ids.length === 0) throw new ValidationError(400, "ids must be a non-empty array");

        return { ids };
    }

    async do(req: LookupVocabularyItemsRequest, _userContext?: UserContext): Promise<LookupVocabularyItemsResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const store = new VocabularyItemStore(db);
        const items = await store.findByIds(req.ids);

        return { items: items.map(toResponse) };
    }
}

function toResponse(item: VocabularyItem) {
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

interface LookupVocabularyItemsRequest {
    ids: string[];
}

interface LookupVocabularyItemsResponse {
    items: ReturnType<typeof toResponse>[];
}

