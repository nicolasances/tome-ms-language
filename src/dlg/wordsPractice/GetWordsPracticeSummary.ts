import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { ModuleStore } from "../../store/ModuleStore";
import { UserModuleProgressStore } from "../../store/UserModuleProgressStore";
import { UserStore } from "../../store/UserStore";
import { UserVocabularyProgressStore } from "../../store/UserVocabularyProgressStore";
import { VocabularyItemStore } from "../../store/VocabularyItemStore";
import { WordsPracticeSessionStore } from "../../store/WordsPracticeSessionStore";
import { WordsPoolLoader } from "../../util/WordsPoolLoader";

export class GetWordsPracticeSummary extends TotoDelegate<GetWordsPracticeSummaryRequest, GetWordsPracticeSummaryResponse> {

    /**
     * The summary takes no input: it is about the authenticated user.
     */
    parseRequest(req: Request): GetWordsPracticeSummaryRequest {

        return {};
    }

    /**
     * Returns the size of the authenticated user's word pool and the id of their open
     * Words Practice session. Read-only.
     */
    async do(req: GetWordsPracticeSummaryRequest, userContext?: UserContext): Promise<GetWordsPracticeSummaryResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const user = await new UserStore({ db, config }).findByEmail(userContext!.email);

        if (!user) throw new ValidationError(404, "User profile not found");

        const loader = new WordsPoolLoader({
            moduleProgressStore: new UserModuleProgressStore({ db, config }),
            moduleStore: new ModuleStore(db),
            vocabularyStore: new VocabularyItemStore(db),
            vocabularyProgressStore: new UserVocabularyProgressStore({ db, config }),
        });

        const pool = await loader.load(user.id);
        const openSession = await new WordsPracticeSessionStore({ db, config }).findInProgressByUser(user.id);

        return { poolSize: pool.length, openSessionId: openSession?.id ?? null };
    }
}

interface GetWordsPracticeSummaryRequest { }

interface GetWordsPracticeSummaryResponse {
    poolSize: number;               // Number of distinct practice words currently in the user's pool; 0 when no module is completed.
    openSessionId: string | null;   // Id of the user's in_progress Words Practice session, or null.
}
