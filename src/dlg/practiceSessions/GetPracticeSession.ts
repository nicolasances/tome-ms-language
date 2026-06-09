import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { PracticeSessionStore } from "../../store/PracticeSessionStore";

export class GetPracticeSession extends TotoDelegate<GetPracticeSessionRequest, GetPracticeSessionResponse> {

    parseRequest(req: Request): GetPracticeSessionRequest {

        const userId = req.params.userId;
        const sessionId = req.params.sessionId;

        if (!userId) throw new ValidationError(400, "userId is required");
        if (!sessionId) throw new ValidationError(400, "sessionId is required");

        return { userId, sessionId };
    }

    async do(req: GetPracticeSessionRequest, userContext?: UserContext): Promise<GetPracticeSessionResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const store = new PracticeSessionStore({ db, config });

        const session = await store.findById(req.sessionId);

        if (!session) throw new ValidationError(404, `Practice session ${req.sessionId} not found`);
        if (session.userId !== req.userId) throw new ValidationError(403, "Session does not belong to the specified user");

        return {
            sessionId: session.id!,
            userId: session.userId,
            moduleId: session.moduleId,
            exerciseIds: session.exerciseIds,
            answers: session.answers,
            currentPosition: session.currentPosition,
            retryQueue: session.retryQueue,
            startedAt: session.startedAt,
            completedAt: session.completedAt,
        };
    }
}

interface GetPracticeSessionRequest {
    userId: string;
    sessionId: string;
}

interface GetPracticeSessionResponse {
    sessionId: string;
    userId: string;
    moduleId: string;
    exerciseIds: string[];
    answers: any[];
    currentPosition: number;
    retryQueue: string[];
    startedAt: string;
    completedAt: string | null;
}
