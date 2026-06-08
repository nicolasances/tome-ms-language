import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { UserGrammarConceptProgressStore } from "../../store/UserGrammarConceptProgressStore";

export class GetUserGrammarProgressItem extends TotoDelegate<GetUserGrammarProgressItemRequest, GetUserGrammarProgressItemResponse> {

    parseRequest(req: Request): GetUserGrammarProgressItemRequest {
        const userId = req.params.userId;
        if (!userId) throw new ValidationError(400, "userId is required");

        const grammarConceptId = req.params.grammarConceptId;
        if (!grammarConceptId) throw new ValidationError(400, "grammarConceptId is required");

        return { userId, grammarConceptId };
    }

    async do(req: GetUserGrammarProgressItemRequest, _userContext?: UserContext): Promise<GetUserGrammarProgressItemResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        const store = new UserGrammarConceptProgressStore({ db, config });

        const progress = await store.findByUserAndConcept(req.userId, req.grammarConceptId);
        if (!progress) throw new ValidationError(404, `No progress record for user '${req.userId}' and grammar concept '${req.grammarConceptId}'`);

        return {
            userId: progress.userId,
            grammarConceptId: progress.grammarConceptId,
            masteryScore: progress.masteryScore,
            lastReviewed: progress.lastReviewed,
            exerciseHistory: progress.exerciseHistory.map(r => r.toBSON()),
        };
    }
}

interface GetUserGrammarProgressItemRequest {
    userId: string;
    grammarConceptId: string;
}

interface GetUserGrammarProgressItemResponse {
    userId: string;
    grammarConceptId: string;
    masteryScore: number;
    lastReviewed: string | null;
    exerciseHistory: any[];
}
