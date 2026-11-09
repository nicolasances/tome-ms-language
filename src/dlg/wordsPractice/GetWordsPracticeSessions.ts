import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { WordsPracticeSession } from "../../model/WordsPracticeSession";
import { WordsPracticeSessionStore } from "../../store/WordsPracticeSessionStore";

export class GetWordsPracticeSessions extends TotoDelegate<GetWordsPracticeSessionsRequest, GetWordsPracticeSessionResponse> {

    /**
     * Extracts userId and sessionId from the route parameters.
     */
    parseRequest(req: Request): GetWordsPracticeSessionsRequest {

        const userId = req.params.userId;

        if (!userId) throw new ValidationError(400, "userId is required");

        return { userId };
    }

    /**
     * Returns the session. A session that does not exist, or that belongs to another user,
     * is a 404.
     */
    async do(req: GetWordsPracticeSessionsRequest, userContext?: UserContext): Promise<GetWordsPracticeSessionResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const sessions = await new WordsPracticeSessionStore({ db, config }).listByUser(req.userId);

        return { sessions };
    }
}

interface GetWordsPracticeSessionsRequest {
    userId: string;     // The user making the request.
}

interface GetWordsPracticeSessionResponse {
    sessions: WordsPracticeSession[];   // The user's sessions, sorted by startedAt descending (most recent first).
}