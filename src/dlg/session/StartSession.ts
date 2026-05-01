import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { Session, VocabularySessionPayload } from "../../model/Session";
import { SessionsStore } from "../../store/SessionsStore";
import { SettingsStore } from "../../store/SettingsStore";
import { VocabularyStore } from "../../store/VocabularyStore";
import { WordStatsStore } from "../../store/WordStatsStore";
import { SUPPORTED_LANGUAGES } from "../../util/Languages";
import { weightedSample } from "../../util/WeightedSampler";

export class StartSession extends TotoDelegate<StartSessionRequest, StartSessionResponse> {

    parseRequest(req: Request): StartSessionRequest {
        const language = req.params.language;
        if (!SUPPORTED_LANGUAGES.includes(language)) {
            throw new ValidationError(400, `Unsupported language: ${language}`);
        }
        const practiceType = req.body?.practiceType;
        if (!practiceType) throw new ValidationError(400, "No practiceType provided");
        if (practiceType !== "vocabulary") throw new ValidationError(400, `Unsupported practiceType: ${practiceType}`);
        return { language, practiceType };
    }

    async do(req: StartSessionRequest, userContext?: UserContext): Promise<StartSessionResponse> {
        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        const userId = userContext!.userId;

        const sessionsStore = new SessionsStore({ db, config });

        const existing = await sessionsStore.findActiveSession({ userId });
        if (existing) throw new ValidationError(409, "User already has an active session");

        const settingsStore = new SettingsStore({ db, config });
        const practiceSettings = await settingsStore.getOrDefault({ practiceType: "vocabulary" });
        const wordCount = (practiceSettings.config as { wordCount: number }).wordCount;
        const defaultFailureRatio = (practiceSettings.config as { defaultFailureRatio: number }).defaultFailureRatio;

        const vocabularyStore = new VocabularyStore(db, config);
        const allWords = await vocabularyStore.findByLanguage(req.language);
        if (allWords.length < wordCount) {
            throw new ValidationError(400, `Not enough words in vocabulary: ${allWords.length} available, ${wordCount} required`);
        }

        const wordStatsStore = new WordStatsStore({ db, config });
        const statsList = await wordStatsStore.findByUserAndLanguage({ userId, language: req.language });
        const statsMap = new Map(statsList.map(s => [s.wordId, s.failureRatio]));

        const selectedWords = weightedSample(
            allWords,
            word => statsMap.has(word.id!) ? statsMap.get(word.id!)! : defaultFailureRatio,
            wordCount
        );

        const payload: VocabularySessionPayload = {
            words: selectedWords.map(w => ({ wordId: w.id!, english: w.english, translation: w.translation })),
            totalWords: selectedWords.length,
            answers: [],
        };

        const session = new Session({
            userId,
            language: req.language,
            practiceType: req.practiceType,
            status: "active",
            payload,
            createdAt: new Date().toISOString(),
            completedAt: null,
        });

        const sessionId = await sessionsStore.createSession({ session });

        return {
            sessionId,
            language: req.language,
            practiceType: req.practiceType,
            payload: {
                words: payload.words,
                totalWords: payload.totalWords,
            },
        };
    }
}

interface StartSessionRequest {
    language: string;
    practiceType: string;
}

interface StartSessionResponse {
    sessionId: string;
    language: string;
    practiceType: string;
    payload: {
        words: Array<{ wordId: string; english: string; translation: string }>;
        totalWords: number;
    };
}
