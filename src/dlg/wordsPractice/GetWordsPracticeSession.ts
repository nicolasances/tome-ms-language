import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { WordsPracticeSession } from "../../model/WordsPracticeSession";
import { WordsPracticeSessionStore } from "../../store/WordsPracticeSessionStore";

export class GetWordsPracticeSession extends TotoDelegate<GetWordsPracticeSessionRequest, WordsPracticeSession> {

    /**
     * Extracts userId and sessionId from the route parameters.
     */
    parseRequest(req: Request): GetWordsPracticeSessionRequest {

        const userId = req.params.userId;
        const sessionId = req.params.sessionId;

        if (!userId) throw new ValidationError(400, "userId is required");
        if (!sessionId) throw new ValidationError(400, "sessionId is required");

        return { userId, sessionId };
    }

    /**
     * Returns the session. A session that does not exist, or that belongs to another user,
     * is a 404.
     */
    async do(req: GetWordsPracticeSessionRequest, userContext?: UserContext): Promise<WordsPracticeSession> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const session = await new WordsPracticeSessionStore({ db, config }).findById(req.sessionId);

        if (!session || session.userId !== req.userId) throw new ValidationError(404, `Words practice session ${req.sessionId} not found`);

        return session;
    }
}

interface GetWordsPracticeSessionRequest {
    userId: string;     // The user making the request.
    sessionId: string;  // The session to load.
}
