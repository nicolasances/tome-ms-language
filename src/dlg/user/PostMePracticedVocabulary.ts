import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { UserStore } from "../../store/UserStore";
import { UserModuleProgressStore } from "../../store/UserModuleProgressStore";

export class PostMePracticedVocabulary extends TotoDelegate<PostMePracticedVocabularyRequest, PostMePracticedVocabularyResponse> {

    /**
     * Validates and extracts the moduleId and the list of practiced vocabulary item ids.
     */
    parseRequest(req: Request): PostMePracticedVocabularyRequest {

        const moduleId = req.params.moduleId;
        const { vocabularyItemIds } = req.body ?? {};

        if (!moduleId) throw new ValidationError(400, "moduleId is required");
        if (!Array.isArray(vocabularyItemIds) || vocabularyItemIds.length === 0) throw new ValidationError(400, "vocabularyItemIds must be a non-empty array");

        return { moduleId, vocabularyItemIds };
    }

    /**
     * Appends the practiced vocabulary item ids to the user's module progress (set-union).
     * Called by the practice flow (F10) after each session to track Step 2 coverage.
     *
     * @return the moduleId and the updated vocabularyItemsPracticed set
     */
    async do(req: PostMePracticedVocabularyRequest, userContext?: UserContext): Promise<PostMePracticedVocabularyResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const user = await new UserStore({ db, config }).findByEmail(userContext!.email);

        if (!user) throw new ValidationError(404, "User profile not found");

        const updated = await new UserModuleProgressStore({ db, config }).appendPracticedVocabulary(user.id, req.moduleId, req.vocabularyItemIds);

        if (!updated) throw new ValidationError(404, "Progress record not found");

        return { moduleId: req.moduleId, vocabularyItemsPracticed: updated.vocabularyItemsPracticed };
    }
}

interface PostMePracticedVocabularyRequest {
    moduleId: string;
    vocabularyItemIds: string[];
}

interface PostMePracticedVocabularyResponse {
    moduleId: string;
    vocabularyItemsPracticed: string[];
}
