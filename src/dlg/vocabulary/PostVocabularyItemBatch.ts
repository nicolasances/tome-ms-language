import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { VocabularyItem, CEFR_LEVELS, VOCABULARY_ITEM_SOURCES, VOCABULARY_ITEM_TYPES } from "../../model/VocabularyItem";
import { VocabularyItemStore } from "../../store/VocabularyItemStore";

export class PostVocabularyItemBatch extends TotoDelegate<PostVocabularyItemBatchRequest, PostVocabularyItemBatchResponse> {

    parseRequest(req: Request): PostVocabularyItemBatchRequest {

        const { items } = req.body ?? {};

        if (!items || !Array.isArray(items) || items.length === 0) throw new ValidationError(400, "items must be a non-empty array");

        const validItems: VocabularyItem[] = [];
        const validationErrors: ValidationErrorItem[] = [];

        for (const raw of items) {
            const reason = validateItemFields(raw);
            if (reason) {
                validationErrors.push({ id: raw.id ?? "(unknown)", reason });
                continue;
            }

            validItems.push(new VocabularyItem({
                id: raw.id,
                danish: raw.danish,
                english: raw.english,
                type: raw.type,
                context: raw.context ?? null,
                tags: raw.tags ?? [],
                cefrLevel: raw.cefrLevel,
                source: raw.source,
                addedByUserId: raw.addedByUserId ?? null,
            }));
        }

        return { items: validItems, validationErrors };
    }

    async do(req: PostVocabularyItemBatchRequest, _userContext?: UserContext): Promise<PostVocabularyItemBatchResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const store = new VocabularyItemStore(db);
        const batchResult = await store.insertBatch(req.items);

        const allItems: PostVocabularyItemBatchResponse["items"] = [
            ...batchResult.items,
            ...req.validationErrors.map(ve => ({ id: ve.id, status: "validation_error" as const, reason: ve.reason })),
        ];

        return {
            inserted: batchResult.inserted,
            alreadyPresent: batchResult.alreadyPresent,
            validationErrors: req.validationErrors.length,
            items: allItems,
        };
    }
}

function validateItemFields(raw: any): string | null {
    if (!raw.id) return "id is required";
    if (!raw.danish) return "danish is required";
    if (!raw.english) return "english is required";
    if (!raw.type || !(VOCABULARY_ITEM_TYPES as readonly string[]).includes(raw.type)) return `type must be one of: ${VOCABULARY_ITEM_TYPES.join(", ")}`;
    if (!raw.cefrLevel || !(CEFR_LEVELS as readonly string[]).includes(raw.cefrLevel)) return `cefrLevel must be one of: ${CEFR_LEVELS.join(", ")}`;
    if (!raw.source || !(VOCABULARY_ITEM_SOURCES as readonly string[]).includes(raw.source)) return `source must be one of: ${VOCABULARY_ITEM_SOURCES.join(", ")}`;
    if (raw.source === "user_added" && !raw.addedByUserId) return "addedByUserId is required when source is user_added";
    if (raw.source === "curriculum" && raw.addedByUserId) return "addedByUserId must be null when source is curriculum";
    return null;
}

interface ValidationErrorItem {
    id: string;
    reason: string;
}

interface PostVocabularyItemBatchRequest {
    items: VocabularyItem[];
    validationErrors: ValidationErrorItem[];
}

interface PostVocabularyItemBatchResponse {
    inserted: number;
    alreadyPresent: number;
    validationErrors: number;
    items: Array<{ id: string; status: string; reason?: string }>;
}

