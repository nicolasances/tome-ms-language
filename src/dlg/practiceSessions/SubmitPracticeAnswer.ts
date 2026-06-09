import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { ExerciseStore } from "../../store/ExerciseStore";
import { PracticeSessionStore } from "../../store/PracticeSessionStore";
import { checkAnswer } from "../../util/AnswerChecker";

export class SubmitPracticeAnswer extends TotoDelegate<SubmitPracticeAnswerRequest, SubmitPracticeAnswerResponse> {

    parseRequest(req: Request): SubmitPracticeAnswerRequest {

        const userId = req.params.userId;
        const sessionId = req.params.sessionId;
        const exerciseId = req.body?.exerciseId;
        const userAnswer = req.body?.userAnswer;

        if (!userId) throw new ValidationError(400, "userId is required");
        if (!sessionId) throw new ValidationError(400, "sessionId is required");
        if (!exerciseId) throw new ValidationError(400, "exerciseId is required");
        if (userAnswer === undefined || userAnswer === null) throw new ValidationError(400, "userAnswer is required");

        return { userId, sessionId, exerciseId, userAnswer: String(userAnswer) };
    }

    async do(req: SubmitPracticeAnswerRequest, userContext?: UserContext): Promise<SubmitPracticeAnswerResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const sessionStore = new PracticeSessionStore({ db, config });

        const session = await sessionStore.findById(req.sessionId);

        if (!session) throw new ValidationError(404, `Practice session ${req.sessionId} not found`);
        if (session.completedAt !== null) throw new ValidationError(400, "Session is already completed");

        const allExerciseIds = [...session.exerciseIds, ...session.retryQueue];

        if (!allExerciseIds.includes(req.exerciseId)) {
            throw new ValidationError(400, `Exercise ${req.exerciseId} is not part of this session`);
        }

        const exerciseStore = new ExerciseStore(db);

        const exercise = await exerciseStore.findById(req.exerciseId);

        if (!exercise) throw new ValidationError(404, `Exercise ${req.exerciseId} not found`);

        const { isCorrect, correctAnswer } = checkAnswer(req.userAnswer, exercise);

        const now = new Date().toISOString();

        await sessionStore.appendAnswer(req.sessionId, {
            exerciseId: req.exerciseId,
            isCorrect,
            userAnswer: req.userAnswer,
            answeredAt: now,
        });

        if (!isCorrect) {
            await sessionStore.addToRetryQueue(req.sessionId, req.exerciseId);
        }

        await sessionStore.advancePosition(req.sessionId);

        await exerciseStore.incrementTimesShown(req.exerciseId);

        return { isCorrect, correctAnswer };
    }
}

interface SubmitPracticeAnswerRequest {
    userId: string;
    sessionId: string;
    exerciseId: string;
    userAnswer: string;
}

interface SubmitPracticeAnswerResponse {
    isCorrect: boolean;
    correctAnswer: string;
}
