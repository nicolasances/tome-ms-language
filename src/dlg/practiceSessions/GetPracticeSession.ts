import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { Exercise } from "../../model/Exercise";
import { ExerciseStore } from "../../store/ExerciseStore";
import { PracticeSessionStore } from "../../store/PracticeSessionStore";

export class GetPracticeSession extends TotoDelegate<GetPracticeSessionRequest, GetPracticeSessionResponse> {

    /**
     * Extracts userId and sessionId from the route parameters.
     */
    parseRequest(req: Request): GetPracticeSessionRequest {

        const userId = req.params.userId;
        const sessionId = req.params.sessionId;

        if (!userId) throw new ValidationError(400, "userId is required");
        if (!sessionId) throw new ValidationError(400, "sessionId is required");

        return { userId, sessionId };
    }

    /**
     * Retrieves a practice session by id and enriches it with full exercise objects.
     * Verifies that the session belongs to the requesting user before returning data.
     */
    async do(req: GetPracticeSessionRequest, userContext?: UserContext): Promise<GetPracticeSessionResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const sessionStore = new PracticeSessionStore({ db, config });

        const session = await sessionStore.findById(req.sessionId);

        if (!session) throw new ValidationError(404, `Practice session ${req.sessionId} not found`);
        if (session.userId !== req.userId) throw new ValidationError(403, "Session does not belong to the specified user");

        const exerciseStore = new ExerciseStore(db);

        const exercises = await exerciseStore.findByIds(session.exerciseIds);

        return {
            sessionId: session.id!,
            userId: session.userId,
            moduleId: session.moduleId,
            exercises,
            answers: session.answers,
            currentPosition: session.currentPosition,
            retryQueue: session.retryQueue,
            startedAt: session.startedAt,
            completedAt: session.completedAt,
        };
    }
}

interface GetPracticeSessionRequest {
    userId: string;     // The id of the user making the request.
    sessionId: string;  // The id of the practice session to retrieve.
}

interface GetPracticeSessionResponse {
    sessionId: string;          // The id of the practice session.
    userId: string;             // The id of the user who owns the session.
    moduleId: string;           // The id of the module this session belongs to.
    exercises: Exercise[];      // Full exercise objects for all exercises in this session.
    answers: any[];             // Answers submitted so far in this session.
    currentPosition: number;    // Zero-based index of the current exercise position.
    retryQueue: string[];       // Exercise ids queued for retry.
    startedAt: string;          // ISO 8601 timestamp of when the session was started.
    completedAt: string | null; // ISO 8601 timestamp of completion, or null if still active.
}
