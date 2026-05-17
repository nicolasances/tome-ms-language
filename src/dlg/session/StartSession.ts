import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { SentenceSessionPayload, Session, VocabularySessionPayload } from "../../model/Session";
import { SentenceStatsStore } from "../../store/SentenceStatsStore";
import { SessionsStore } from "../../store/SessionsStore";
import { SettingsStore } from "../../store/SettingsStore";
import { VocabularyStore } from "../../store/VocabularyStore";
import { WordStatsStore } from "../../store/WordStatsStore";
import { SUPPORTED_LANGUAGES } from "../../util/Languages";
import { weightedSample } from "../../util/WeightedSampler";
import { SentenceStore } from "../../store/SentenceStore";
import { SentencePracticeConfig, VocabularyPracticeConfig } from "../../model/PracticeSettings";

export class StartSession extends TotoDelegate<StartSessionRequest, StartSessionResponse> {

    parseRequest(req: Request): StartSessionRequest {
        const language = req.params.language;
        if (!SUPPORTED_LANGUAGES.includes(language)) {
            throw new ValidationError(400, `Unsupported language: ${language}`);
        }
        const practiceType = req.body?.practiceType;
        if (!practiceType) throw new ValidationError(400, "No practiceType provided");
        if (practiceType !== "vocabulary" && practiceType !== "sentences") {
            throw new ValidationError(400, `Unsupported practiceType: ${practiceType}`);
        }
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

        if (req.practiceType === "vocabulary") {
            const practiceSettings = await settingsStore.getOrDefault({ practiceType: "vocabulary" });
            const { wordCount, defaultFailureRatio } = practiceSettings.config as VocabularyPracticeConfig;

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
                words: selectedWords.map(w => ({ wordId: w.id!, english: w.english, translation: w.translation, alternativeTranslations: w.alternativeTranslations })),
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

        // sentences branch
        const practiceSettings = await settingsStore.getOrDefault({ practiceType: "sentences" });
        const { sentenceCount, defaultFailureRatio } = practiceSettings.config as SentencePracticeConfig;

        const sentenceStore = new SentenceStore(db, config);
        const allSentences = await sentenceStore.findByLanguage(req.language);
        if (allSentences.length < sentenceCount) {
            throw new ValidationError(400, `Not enough sentences: ${allSentences.length} available, ${sentenceCount} required`);
        }

        const sentenceStatsStore = new SentenceStatsStore({ db, config });
        const statsList = await sentenceStatsStore.findByUserAndLanguage({ userId, language: req.language });
        const statsMap = new Map(statsList.map(s => [s.sentenceId, s.failureRatio]));

        const selectedSentences = weightedSample(
            allSentences,
            s => statsMap.has(s.id!) ? statsMap.get(s.id!)! : defaultFailureRatio,
            sentenceCount
        );

        const payload: SentenceSessionPayload = {
            sentences: selectedSentences.map(s => ({ sentenceId: s.id!, sentence: s.sentence, translation: s.translation, alternativeTranslations: s.alternativeTranslations })),
            totalSentences: selectedSentences.length,
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
                sentences: payload.sentences,
                totalSentences: payload.totalSentences,
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
        // vocabulary
        words?: Array<{ wordId: string; english: string; translation: string; alternativeTranslations: Array<{ id: string; translation: string }> }>;
        totalWords?: number;
        // sentences
        sentences?: Array<{ sentenceId: string; sentence: string; translation: string; alternativeTranslations: Array<{ id: string; translation: string }> }>;
        totalSentences?: number;
    };
}
