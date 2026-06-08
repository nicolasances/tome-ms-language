import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { UserVocabularyProgressStore } from "../../store/UserVocabularyProgressStore";

export class GetUserVocabularyProgressItem extends TotoDelegate<GetUserVocabularyProgressItemRequest, GetUserVocabularyProgressItemResponse> {

    parseRequest(req: Request): GetUserVocabularyProgressItemRequest {
        const userId = req.params.userId;
        if (!userId) throw new ValidationError(400, "userId is required");

        const vocabularyItemId = req.params.vocabularyItemId;
        if (!vocabularyItemId) throw new ValidationError(400, "vocabularyItemId is required");

        return { userId, vocabularyItemId };
    }

    async do(req: GetUserVocabularyProgressItemRequest, _userContext?: UserContext): Promise<GetUserVocabularyProgressItemResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        const store = new UserVocabularyProgressStore({ db, config });

        const progress = await store.findByUserAndItem(req.userId, req.vocabularyItemId);
        if (!progress) throw new ValidationError(404, `No progress record for user '${req.userId}' and vocabulary item '${req.vocabularyItemId}'`);

        return {
            userId: progress.userId,
            vocabularyItemId: progress.vocabularyItemId,
            masteryScore: progress.masteryScore,
            lastReviewed: progress.lastReviewed,
            exerciseHistory: progress.exerciseHistory.map(r => r.toBSON()),
        };
    }
}

interface GetUserVocabularyProgressItemRequest {
    userId: string;
    vocabularyItemId: string;
}

interface GetUserVocabularyProgressItemResponse {
    userId: string;
    vocabularyItemId: string;
    masteryScore: number;
    lastReviewed: string | null;
    exerciseHistory: any[];
}
