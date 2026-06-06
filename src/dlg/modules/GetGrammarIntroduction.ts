import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { GrammarConceptExample } from "../../model/GrammarConcept";
import { GrammarConceptStore } from "../../store/GrammarConceptStore";
import { ModuleStore } from "../../store/ModuleStore";

export class GetGrammarIntroduction extends TotoDelegate<GetGrammarIntroductionRequest, GetGrammarIntroductionResponse> {

    /**
     * Parses moduleId from the route params.
     */
    parseRequest(req: Request): GetGrammarIntroductionRequest {

        const moduleId = req.params.moduleId;

        if (!moduleId) throw new ValidationError(400, "moduleId is required");

        return { moduleId };
    }

    /**
     * Returns the module's grammar concepts with name, explanation, and examples,
     * ordered to match the grammarConceptIds array on the module document.
     */
    async do(req: GetGrammarIntroductionRequest, _userContext?: UserContext): Promise<GetGrammarIntroductionResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const moduleStore = new ModuleStore(db);

        const module = await moduleStore.findById(req.moduleId);

        if (!module) throw new ValidationError(404, `Module with id '${req.moduleId}' not found`);

        if (module.grammarConceptIds.length === 0) {
            return { concepts: [] };
        }

        const conceptStore = new GrammarConceptStore(db);

        const concepts = await conceptStore.findByIds(module.grammarConceptIds);

        // Re-sort to match grammarConceptIds order: MongoDB $in does not preserve insertion order.
        const conceptById = new Map(concepts.map(c => [c.id, c]));

        const ordered = module.grammarConceptIds.map(id => conceptById.get(id)).filter((c): c is NonNullable<typeof c> => c !== undefined);

        return {
            concepts: ordered.map(c => ({
                name: c.name,
                explanation: c.explanation,
                examples: c.examples,
            })),
        };
    }
}

interface GetGrammarIntroductionRequest {
    moduleId: string;
}

interface GetGrammarIntroductionResponse {
    concepts: GrammarConceptSummary[];
}

interface GrammarConceptSummary {
    name: string;
    explanation: string;
    examples: GrammarConceptExample[];
}
