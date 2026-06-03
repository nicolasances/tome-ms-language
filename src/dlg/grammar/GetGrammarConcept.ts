import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { GrammarConcept } from "../../model/GrammarConcept";
import { GrammarConceptStore } from "../../store/GrammarConceptStore";

export class GetGrammarConcept extends TotoDelegate<GetGrammarConceptRequest, GetGrammarConceptResponse> {

    parseRequest(req: Request): GetGrammarConceptRequest {

        const id = req.params.id;

        if (!id) throw new ValidationError(400, "id is required");

        return { id };
    }

    async do(req: GetGrammarConceptRequest, _userContext?: UserContext): Promise<GetGrammarConceptResponse> {

        const config = this.config as ControllerConfig;

        const db = await config.getMongoDb(config.getDBName());

        const store = new GrammarConceptStore(db);
        const concept = await store.findById(req.id);

        if (!concept) throw new ValidationError(404, `Grammar concept '${req.id}' not found`);

        return toResponse(concept);
    }
}

function toResponse(concept: GrammarConcept): GetGrammarConceptResponse {

    return {
        id: concept.id,
        name: concept.name,
        category: concept.category,
        cefrLevelIntroduced: concept.cefrLevelIntroduced,
        explanation: concept.explanation,
        examples: concept.examples,
    };
}

interface GetGrammarConceptRequest {
    id: string;
}

interface GetGrammarConceptResponse {
    id: string;
    name: string;
    category: string;
    cefrLevelIntroduced: string;
    explanation: string;
    examples: Array<{ danish: string; english: string }>;
}

