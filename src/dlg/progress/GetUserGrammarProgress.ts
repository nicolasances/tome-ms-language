import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { UserGrammarConceptProgress } from "../../model/UserGrammarConceptProgress";
import { UserGrammarConceptProgressStore } from "../../store/UserGrammarConceptProgressStore";

export class GetUserGrammarProgress extends TotoDelegate<GetUserGrammarProgressRequest, GetUserGrammarProgressResponse> {

    parseRequest(req: Request): GetUserGrammarProgressRequest {
        const userId = req.params.userId;
        if (!userId) throw new ValidationError(400, "userId is required");
        return { userId };
    }

    async do(req: GetUserGrammarProgressRequest, _userContext?: UserContext): Promise<GetUserGrammarProgressResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        const store = new UserGrammarConceptProgressStore({ db, config });

        const items = await store.listByUser(req.userId);

        return { items: items.map(toResponse) };
    }
}

function toResponse(progress: UserGrammarConceptProgress) {
    return {
        userId: progress.userId,
        grammarConceptId: progress.grammarConceptId,
        masteryScore: progress.masteryScore,
        lastReviewed: progress.lastReviewed,
        exerciseHistory: progress.exerciseHistory.map(r => r.toBSON()),
    };
}

interface GetUserGrammarProgressRequest {
    userId: string;
}

interface GetUserGrammarProgressResponse {
    items: ReturnType<typeof toResponse>[];
}
