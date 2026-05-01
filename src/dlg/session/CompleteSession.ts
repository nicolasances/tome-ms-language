import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { SessionsStore } from "../../store/SessionsStore";
import { WordStatsStore } from "../../store/WordStatsStore";

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

        // Compute per-word answer stats from the session answer history
        const wordStats = session.payload.words.map(word => {
            const wordAnswers = session.payload.answers.filter(a => a.entityId === word.wordId);
            return {
                wordId: word.wordId,
                sessionAttempts: wordAnswers.length,
                sessionFailures: wordAnswers.filter(a => !a.isCorrect).length,
                firstAttemptCorrect: wordAnswers.length > 0 && wordAnswers[0].isCorrect,
            };
        });

        // Upsert word_stats BEFORE marking the session completed so a stats
        // failure leaves the session active and the caller can retry
        const wordStatsStore = new WordStatsStore({ db, config });
        await wordStatsStore.upsertBatch({
            statsList: wordStats.map(ws => ({
                userId,
                wordId: ws.wordId,
                language: session.language,
                sessionAttempts: ws.sessionAttempts,
                sessionFailures: ws.sessionFailures,
                lastPracticed: now,
            })),
        });

        await sessionsStore.completeSession({ sessionId: req.sessionId });

        const firstAttemptCorrectCount = wordStats.filter(ws => ws.firstAttemptCorrect).length;
        const totalWords = session.payload.words.length;

        return {
            totalWords,
            firstAttemptCorrect: firstAttemptCorrectCount,
            accuracy: Math.round((firstAttemptCorrectCount / totalWords) * 100),
            wordResults: session.payload.words.map(word => {
                const ws = wordStats.find(s => s.wordId === word.wordId)!;
                return {
                    wordId: word.wordId,
                    english: word.english,
                    translation: word.translation,
                    failedAttempts: ws.sessionFailures,
                };
            }),
        };
    }
}

interface CompleteSessionRequest {
    sessionId: string;
}

interface CompleteSessionResponse {
    totalWords: number;
    firstAttemptCorrect: number;
    accuracy: number;
    wordResults: Array<{
        wordId: string;
        english: string;
        translation: string;
        failedAttempts: number;
    }>;
}
