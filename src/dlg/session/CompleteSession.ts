import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { SentenceSessionPayload, VocabularySessionPayload } from "../../model/Session";
import { SentenceStatsStore } from "../../store/SentenceStatsStore";
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

        if (session.practiceType === "vocabulary") {
            const vocabPayload = session.payload as VocabularySessionPayload;

            const wordStats = vocabPayload.words.map(word => {
                const wordAnswers = vocabPayload.answers.filter(a => a.entityId === word.wordId);
                return {
                    wordId: word.wordId,
                    sessionAttempts: wordAnswers.length,
                    sessionFailures: wordAnswers.filter(a => !a.isCorrect).length,
                    firstAttemptCorrect: wordAnswers.length > 0 && wordAnswers[0].isCorrect,
                };
            });

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
            const totalWords = vocabPayload.words.length;

            return {
                practiceType: "vocabulary",
                totalWords,
                firstAttemptCorrect: firstAttemptCorrectCount,
                accuracy: Math.round((firstAttemptCorrectCount / totalWords) * 100),
                wordResults: vocabPayload.words.map(word => {
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

        // sentences branch
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
    // vocabulary fields
    totalWords?: number;
    wordResults?: Array<{
        wordId: string;
        english: string;
        translation: string;
        failedAttempts: number;
    }>;
    // sentences fields
    totalSentences?: number;
    sentenceResults?: Array<{
        sentenceId: string;
        sentence: string;
        translation: string;
        failedAttempts: number;
    }>;
    // common
    firstAttemptCorrect: number;
    accuracy: number;
}
