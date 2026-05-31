import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { GrammarConcept, GrammarConceptExample, GRAMMAR_CONCEPT_CATEGORIES, CEFR_LEVELS } from "../model/GrammarConcept";
import { GrammarConceptStore } from "../store/GrammarConceptStore";

export class PostGrammarConcept extends TotoDelegate<PostGrammarConceptRequest, PostGrammarConceptResponse> {

    parseRequest(req: Request): PostGrammarConceptRequest {

        const { id, name, category, cefrLevelIntroduced, explanation, examples } = req.body ?? {};

        if (!id) throw new ValidationError(400, "id is required");
        if (!name) throw new ValidationError(400, "name is required");
        if (!category || !(GRAMMAR_CONCEPT_CATEGORIES as readonly string[]).includes(category)) throw new ValidationError(400, `category must be one of: ${GRAMMAR_CONCEPT_CATEGORIES.join(", ")}`);
        if (!cefrLevelIntroduced || !(CEFR_LEVELS as readonly string[]).includes(cefrLevelIntroduced)) throw new ValidationError(400, `cefrLevelIntroduced must be one of: ${CEFR_LEVELS.join(", ")}`);
        if (!explanation) throw new ValidationError(400, "explanation is required");
        if (!examples || !Array.isArray(examples) || examples.length === 0) throw new ValidationError(400, "examples must be a non-empty array");
        if (examples.length > 2) throw new ValidationError(400, "examples must have at most 2 items");

        for (const ex of examples) {
            if (!ex.danish) throw new ValidationError(400, "each example must have a danish string");
            if (!ex.english) throw new ValidationError(400, "each example must have an english string");
        }

        return { id, name, category, cefrLevelIntroduced, explanation, examples };
    }

    async do(req: PostGrammarConceptRequest, _userContext?: UserContext): Promise<PostGrammarConceptResponse> {

        const config = this.config as ControllerConfig;

        const db = await config.getMongoDb(config.getDBName());

        const store = new GrammarConceptStore(db);
        const concept = new GrammarConcept(req);

        const result = await store.insertOne(concept);

        if (result.status === "duplicate_id") throw new ValidationError(409, `Grammar concept with id '${req.id}' already exists`);

        return { id: result.concept.id };
    }
}

interface PostGrammarConceptRequest {
    id: string;
    name: string;
    category: string;
    cefrLevelIntroduced: string;
    explanation: string;
    examples: GrammarConceptExample[];
}

interface PostGrammarConceptResponse {
    id: string;
}
