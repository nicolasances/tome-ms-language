import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { VocabularyItem, CEFR_LEVELS } from "../model/VocabularyItem";
import { VocabularyItemStore } from "../store/VocabularyItemStore";

export class GetVocabularyItems extends TotoDelegate<GetVocabularyItemsRequest, GetVocabularyItemsResponse> {

    parseRequest(req: Request): GetVocabularyItemsRequest {

        const cefrLevel = req.query.cefrLevel as string | undefined;

        if (cefrLevel && !(CEFR_LEVELS as readonly string[]).includes(cefrLevel)) throw new ValidationError(400, `cefrLevel must be one of: ${CEFR_LEVELS.join(", ")}`);

        return { cefrLevel };
    }

    async do(req: GetVocabularyItemsRequest, _userContext?: UserContext): Promise<GetVocabularyItemsResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const store = new VocabularyItemStore(db);
        const items = await store.list(req.cefrLevel);

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

interface GetVocabularyItemsRequest {
    cefrLevel?: string;
}

interface GetVocabularyItemsResponse {
    items: ReturnType<typeof toResponse>[];
}
