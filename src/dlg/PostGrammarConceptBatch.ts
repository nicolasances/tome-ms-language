import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { GrammarConcept, GRAMMAR_CONCEPT_CATEGORIES, CEFR_LEVELS } from "../model/GrammarConcept";
import { GrammarConceptStore } from "../store/GrammarConceptStore";

export class PostGrammarConceptBatch extends TotoDelegate<PostGrammarConceptBatchRequest, PostGrammarConceptBatchResponse> {

    parseRequest(req: Request): PostGrammarConceptBatchRequest {

        const { items } = req.body ?? {};

        if (!items || !Array.isArray(items) || items.length === 0) throw new ValidationError(400, "items must be a non-empty array");

        const validItems: GrammarConcept[] = [];
        const validationErrors: ValidationErrorItem[] = [];

        for (const raw of items) {

            const reason = validateItem(raw);

            if (reason) {
                validationErrors.push({ id: raw.id ?? "(unknown)", reason });
                continue;
            }

            validItems.push(new GrammarConcept({
                id: raw.id,
                name: raw.name,
                category: raw.category,
                cefrLevelIntroduced: raw.cefrLevelIntroduced,
                explanation: raw.explanation,
                examples: raw.examples,
            }));
        }

        return { items: validItems, validationErrors };
    }

    async do(req: PostGrammarConceptBatchRequest, _userContext?: UserContext): Promise<PostGrammarConceptBatchResponse> {

        const config = this.config as ControllerConfig;

        const db = await config.getMongoDb(config.getDBName());

        const store = new GrammarConceptStore(db);
        const batchResult = await store.insertBatch(req.items);

        const allItems: PostGrammarConceptBatchResponse["items"] = [
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

function validateItem(raw: any): string | null {

    if (!raw.id) return "id is required";
    if (!raw.name) return "name is required";
    if (!raw.category || !(GRAMMAR_CONCEPT_CATEGORIES as readonly string[]).includes(raw.category)) return `category must be one of: ${GRAMMAR_CONCEPT_CATEGORIES.join(", ")}`;
    if (!raw.cefrLevelIntroduced || !(CEFR_LEVELS as readonly string[]).includes(raw.cefrLevelIntroduced)) return `cefrLevelIntroduced must be one of: ${CEFR_LEVELS.join(", ")}`;
    if (!raw.explanation) return "explanation is required";
    if (!raw.examples || !Array.isArray(raw.examples) || raw.examples.length === 0) return "examples must be a non-empty array";
    if (raw.examples.length > 2) return "examples must have at most 2 items";

    for (const ex of raw.examples) {
        if (!ex.danish) return "each example must have a danish string";
        if (!ex.english) return "each example must have an english string";
    }

    return null;
}

interface ValidationErrorItem {
    id: string;
    reason: string;
}

interface PostGrammarConceptBatchRequest {
    items: GrammarConcept[];
    validationErrors: ValidationErrorItem[];
}

interface PostGrammarConceptBatchResponse {
    inserted: number;
    alreadyPresent: number;
    validationErrors: number;
    items: Array<{ id: string; status: string; reason?: string }>;
}
