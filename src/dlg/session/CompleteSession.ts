import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { SentenceSessionPayload } from "../../model/Session";
import { SentenceStatsStore } from "../../store/SentenceStatsStore";
import { SessionsStore } from "../../store/SessionsStore";

export class CompleteSession extends TotoDelegate<CompleteSessionRequest, CompleteSessionResponse> {

    parseRequest(req: Request): CompleteSessionRequest {
        return { sessionId: req.params.sessionId };
    }

    async do(req: CompleteSessionRequest, userContext?: UserContext): Promise<CompleteSessionResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        const userId = userContext!.userId;

        const sessionsStore = new SessionsStore({ db, config });

        const session = await sessionsStore.findSessionById({ sessionId: req.sessionId });

        if (!session) throw new ValidationError(404, "Session not found");
        if (session.userId !== userId) throw new ValidationError(403, "Session does not belong to the authenticated user");
        if (session.status === "completed") throw new ValidationError(400, "Session is already completed");

        const now = new Date().toISOString();
        const sentencePayload = session.payload as SentenceSessionPayload;

        const sentenceStats = sentencePayload.sentences.map(s => {
            const sentenceAnswers = sentencePayload.answers.filter(a => a.entityId === s.sentenceId);
            return {
                sentenceId: s.sentenceId,
                sessionAttempts: sentenceAnswers.length,
                sessionFailures: sentenceAnswers.filter(a => !a.isCorrect).length,
                firstAttemptCorrect: sentenceAnswers.length > 0 && sentenceAnswers[0].isCorrect,
            };
        });

        const sentenceStatsStore = new SentenceStatsStore({ db, config });

        await sentenceStatsStore.upsertBatch({
            statsList: sentenceStats.map(ss => ({
                userId,
                sentenceId: ss.sentenceId,
                language: session.language,
                sessionAttempts: ss.sessionAttempts,
                sessionFailures: ss.sessionFailures,
                lastPracticed: now,
            })),
        });

        await sessionsStore.completeSession({ sessionId: req.sessionId });

        const firstAttemptCorrectCount = sentenceStats.filter(ss => ss.firstAttemptCorrect).length;
        const totalSentences = sentencePayload.sentences.length;

        return {
            practiceType: "sentences",
            totalSentences,
            firstAttemptCorrect: firstAttemptCorrectCount,
            accuracy: Math.round((firstAttemptCorrectCount / totalSentences) * 100),
            sentenceResults: sentencePayload.sentences.map(s => {
                const ss = sentenceStats.find(stat => stat.sentenceId === s.sentenceId)!;
                return {
                    sentenceId: s.sentenceId,
                    sentence: s.sentence,
                    translation: s.translation,
                    failedAttempts: ss.sessionFailures,
                };
            }),
        };
    }
}

interface CompleteSessionRequest {
    sessionId: string;
}

interface CompleteSessionResponse {
    practiceType: string;
    totalSentences: number;
    sentenceResults: Array<{
        sentenceId: string;
        sentence: string;
        translation: string;
        failedAttempts: number;
    }>;
    firstAttemptCorrect: number;
    accuracy: number;
}
