import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { GrammarConcept } from "../model/GrammarConcept";
import { GrammarConceptStore } from "../store/GrammarConceptStore";

export class LookupGrammarConcepts extends TotoDelegate<LookupGrammarConceptsRequest, LookupGrammarConceptsResponse> {

    parseRequest(req: Request): LookupGrammarConceptsRequest {

        const { ids } = req.body ?? {};

        if (!ids || !Array.isArray(ids) || ids.length === 0) throw new ValidationError(400, "ids must be a non-empty array");

        return { ids };
    }

    async do(req: LookupGrammarConceptsRequest, _userContext?: UserContext): Promise<LookupGrammarConceptsResponse> {

        const config = this.config as ControllerConfig;

        const db = await config.getMongoDb(config.getDBName());

        const store = new GrammarConceptStore(db);
        const concepts = await store.findByIds(req.ids);

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

interface LookupGrammarConceptsRequest {
    ids: string[];
}

interface LookupGrammarConceptsResponse {
    items: ReturnType<typeof toResponse>[];
}
