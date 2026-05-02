import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { SessionAnswer } from "../../model/Session";
import { SessionsStore } from "../../store/SessionsStore";

export class SubmitAnswer extends TotoDelegate<SubmitAnswerRequest, SubmitAnswerResponse> {

    parseRequest(req: Request): SubmitAnswerRequest {
        const sessionId = req.params.sessionId;
        const { entityId, isCorrect } = req.body ?? {};
        if (!entityId) throw new ValidationError(400, "No entityId provided");
        if (isCorrect === undefined || isCorrect === null) throw new ValidationError(400, "No isCorrect provided");
        return { sessionId, entityId, isCorrect: Boolean(isCorrect) };
    }

    async do(req: SubmitAnswerRequest, userContext?: UserContext): Promise<SubmitAnswerResponse> {
        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        const userId = userContext!.userId;

        const store = new SessionsStore({ db, config });
        const session = await store.findSessionById({ sessionId: req.sessionId });

        if (!session) throw new ValidationError(404, "Session not found");
        if (session.userId !== userId) throw new ValidationError(403, "Session does not belong to the authenticated user");
        if (session.status === "completed") throw new ValidationError(400, "Session is already completed");

        const wordExists = session.payload.words.some(w => w.wordId === req.entityId);
        if (!wordExists) throw new ValidationError(400, `entityId ${req.entityId} is not part of this session`);

        const answer: SessionAnswer = {
            entityId: req.entityId,
            isCorrect: req.isCorrect,
            submittedAt: new Date().toISOString(),
        };

        await store.appendAnswer({ sessionId: req.sessionId, answer });

        return { recorded: true };
    }
}

interface SubmitAnswerRequest {
    sessionId: string;
    entityId: string;
    isCorrect: boolean;
}

interface SubmitAnswerResponse {
    recorded: boolean;
}
