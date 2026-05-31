import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { VocabularyItem, CEFR_LEVELS, VOCABULARY_ITEM_SOURCES, VOCABULARY_ITEM_TYPES } from "../model/VocabularyItem";
import { VocabularyItemStore } from "../store/VocabularyItemStore";

export class PostVocabularyItem extends TotoDelegate<PostVocabularyItemRequest, PostVocabularyItemResponse> {

    parseRequest(req: Request): PostVocabularyItemRequest {

        const { id, danish, english, type, context, tags, cefrLevel, source, addedByUserId } = req.body ?? {};

        if (!id) throw new ValidationError(400, "id is required");
        if (!danish) throw new ValidationError(400, "danish is required");
        if (!english) throw new ValidationError(400, "english is required");
        if (!type || !(VOCABULARY_ITEM_TYPES as readonly string[]).includes(type)) throw new ValidationError(400, `type must be one of: ${VOCABULARY_ITEM_TYPES.join(", ")}`);
        if (!cefrLevel || !(CEFR_LEVELS as readonly string[]).includes(cefrLevel)) throw new ValidationError(400, `cefrLevel must be one of: ${CEFR_LEVELS.join(", ")}`);
        if (!source || !(VOCABULARY_ITEM_SOURCES as readonly string[]).includes(source)) throw new ValidationError(400, `source must be one of: ${VOCABULARY_ITEM_SOURCES.join(", ")}`);
        if (source === "user_added" && !addedByUserId) throw new ValidationError(400, "addedByUserId is required when source is user_added");
        if (source === "curriculum" && addedByUserId) throw new ValidationError(400, "addedByUserId must be null when source is curriculum");

        return {
            id,
            danish,
            english,
            type,
            context: context ?? null,
            tags: tags ?? [],
            cefrLevel,
            source,
            addedByUserId: addedByUserId ?? null,
        };
    }

    async do(req: PostVocabularyItemRequest, _userContext?: UserContext): Promise<PostVocabularyItemResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const store = new VocabularyItemStore(db);
        const item = new VocabularyItem(req);

        const result = await store.insertOne(item);

        if (result.status === "duplicate_id") throw new ValidationError(409, `Vocabulary item with id '${req.id}' already exists`);
        if (result.status === "duplicate_canonical") throw new ValidationError(409, `A vocabulary item with the same (danish, type, context) already exists`);

        return { id: result.item.id };
    }
}

interface PostVocabularyItemRequest {
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

interface PostVocabularyItemResponse {
    id: string;
}
