import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { UserVocabularyProgress } from "../../model/UserVocabularyProgress";
import { UserVocabularyProgressStore } from "../../store/UserVocabularyProgressStore";

export class GetUserVocabularyProgress extends TotoDelegate<GetUserVocabularyProgressRequest, GetUserVocabularyProgressResponse> {

    parseRequest(req: Request): GetUserVocabularyProgressRequest {
        const userId = req.params.userId;
        if (!userId) throw new ValidationError(400, "userId is required");
        return { userId };
    }

    async do(req: GetUserVocabularyProgressRequest, _userContext?: UserContext): Promise<GetUserVocabularyProgressResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        const store = new UserVocabularyProgressStore({ db, config });

        const items = await store.listByUser(req.userId);

        return { items: items.map(toResponse) };
    }
}

function toResponse(progress: UserVocabularyProgress) {
    return {
        userId: progress.userId,
        vocabularyItemId: progress.vocabularyItemId,
        masteryScore: progress.masteryScore,
        lastReviewed: progress.lastReviewed,
        exerciseHistory: progress.exerciseHistory.map(r => r.toBSON()),
    };
}

interface GetUserVocabularyProgressRequest {
    userId: string;
}

interface GetUserVocabularyProgressResponse {
    items: ReturnType<typeof toResponse>[];
}
