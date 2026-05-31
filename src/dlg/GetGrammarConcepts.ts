import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { GrammarConcept, GRAMMAR_CONCEPT_CATEGORIES, CEFR_LEVELS } from "../model/GrammarConcept";
import { GrammarConceptStore } from "../store/GrammarConceptStore";

export class GetGrammarConcepts extends TotoDelegate<GetGrammarConceptsRequest, GetGrammarConceptsResponse> {

    parseRequest(req: Request): GetGrammarConceptsRequest {

        const cefrLevel = req.query.cefrLevel as string | undefined;
        const category = req.query.category as string | undefined;

        if (cefrLevel && !(CEFR_LEVELS as readonly string[]).includes(cefrLevel)) throw new ValidationError(400, `cefrLevel must be one of: ${CEFR_LEVELS.join(", ")}`);
        if (category && !(GRAMMAR_CONCEPT_CATEGORIES as readonly string[]).includes(category)) throw new ValidationError(400, `category must be one of: ${GRAMMAR_CONCEPT_CATEGORIES.join(", ")}`);

        return { cefrLevel, category };
    }

    async do(req: GetGrammarConceptsRequest, _userContext?: UserContext): Promise<GetGrammarConceptsResponse> {

        const config = this.config as ControllerConfig;

        const db = await config.getMongoDb(config.getDBName());

        const store = new GrammarConceptStore(db);
        const concepts = await store.list(req.cefrLevel, req.category);

        return { items: concepts.map(toResponse) };
    }
}

function toResponse(concept: GrammarConcept) {

    return {
        id: concept.id,
        name: concept.name,
        category: concept.category,
        cefrLevelIntroduced: concept.cefrLevelIntroduced,
        explanation: concept.explanation,
        examples: concept.examples,
    };
}

interface GetGrammarConceptsRequest {
    cefrLevel?: string;
    category?: string;
}

interface GetGrammarConceptsResponse {
    items: ReturnType<typeof toResponse>[];
}
