import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { SentenceSessionPayload, Session } from "../../model/Session";
import { SentenceStatsStore } from "../../store/SentenceStatsStore";
import { SessionsStore } from "../../store/SessionsStore";
import { SettingsStore } from "../../store/SettingsStore";
import { SUPPORTED_LANGUAGES } from "../../util/Languages";
import { weightedSample } from "../../util/WeightedSampler";
import { SentenceStore } from "../../store/SentenceStore";
import { SentencePracticeConfig } from "../../model/PracticeSettings";

export class StartSession extends TotoDelegate<StartSessionRequest, StartSessionResponse> {

    parseRequest(req: Request): StartSessionRequest {

        const language = req.params.language;
        const practiceType = req.body?.practiceType;

        if (!SUPPORTED_LANGUAGES.includes(language)) throw new ValidationError(400, `Unsupported language: ${language}`);
        if (!practiceType) throw new ValidationError(400, "No practiceType provided");
        if (practiceType !== "sentences") throw new ValidationError(400, `Unsupported practiceType: ${practiceType}`);

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
        const practiceSettings = await settingsStore.getOrDefault({ practiceType: "sentences" });
        const { sentenceCount, defaultFailureRatio } = practiceSettings.config as SentencePracticeConfig;

        const sentenceStore = new SentenceStore(db, config);

        const allSentences = await sentenceStore.findByLanguage(req.language);

        if (allSentences.length < sentenceCount) throw new ValidationError(400, `Not enough sentences: ${allSentences.length} available, ${sentenceCount} required`);

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
        sentences: Array<{ sentenceId: string; sentence: string; translation: string; alternativeTranslations: Array<{ id: string; translation: string }> }>;
        totalSentences: number;
    };
}
