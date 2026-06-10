import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { PRACTICE_MIN_UNSEEN_VOCAB_PERCENT } from "../../Config";
import { ControllerConfig } from "../../Config";
import { Exercise, EXERCISE_TYPES } from "../../model/Exercise";
import { PracticeSession } from "../../model/PracticeSession";
import { ExerciseStore } from "../../store/ExerciseStore";
import { ModuleStore } from "../../store/ModuleStore";
import { PracticeSessionStore } from "../../store/PracticeSessionStore";
import { UserGrammarConceptProgressStore } from "../../store/UserGrammarConceptProgressStore";
import { UserModuleProgressStore } from "../../store/UserModuleProgressStore";
import { UserVocabularyProgressStore } from "../../store/UserVocabularyProgressStore";
import { selectExercises } from "../../util/ExerciseSelector";

/**
 * Type-progression order for exercises within a practice session (F10).
 * Lower index = shown earlier (recognition before production).
 */
const TYPE_ORDER: Record<string, number> = {
    multiple_choice: 0,
    sentence_reorder: 1,
    fill_blank: 2,
    conjugation_drill: 3,
    error_correction: 4,
    translation_active: 5,
};

class ActiveSessionError extends ValidationError {

    sessionId: string;

    constructor(sessionId: string) {
        super(409, "An active practice session already exists for this module");
        this.sessionId = sessionId;
    }
}

export class StartPracticeSession extends TotoDelegate<StartPracticeSessionRequest, StartPracticeSessionResponse> {

    parseRequest(req: Request): StartPracticeSessionRequest {

        const userId = req.params.userId;
        const moduleId = req.params.moduleId;

        if (!userId) throw new ValidationError(400, "userId is required");
        if (!moduleId) throw new ValidationError(400, "moduleId is required");

        return { userId, moduleId };
    }

    async do(req: StartPracticeSessionRequest, userContext?: UserContext): Promise<StartPracticeSessionResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        const userId = req.userId;

        const practiceSessionStore = new PracticeSessionStore({ db, config });

        const existing = await practiceSessionStore.findActiveByUserAndModule(userId, req.moduleId);

        if (existing) throw new ActiveSessionError(existing.id!);

        const moduleStore = new ModuleStore(db);
        const module = await moduleStore.findById(req.moduleId);

        if (!module) throw new ValidationError(404, `Module ${req.moduleId} not found`);

        const exerciseStore = new ExerciseStore(db);
        const allExercises = await exerciseStore.listByModuleId(req.moduleId);

        const userModuleProgressStore = new UserModuleProgressStore({ db, config });
        const progress = await userModuleProgressStore.findByUserAndModule(userId, req.moduleId);
        const seenVocabIds = new Set(progress?.vocabularyItemsPracticed ?? []);

        const vocabProgressStore = new UserVocabularyProgressStore({ db, config });
        const grammarProgressStore = new UserGrammarConceptProgressStore({ db, config });

        const vocabProgressList = await vocabProgressStore.listByUser(userId, module.vocabularyItemIds);
        const grammarProgressList = await grammarProgressStore.listByUser(userId, module.grammarConceptIds);

        const masteryByItemId = new Map<string, number>([
            ...vocabProgressList.map((p): [string, number] => [p.vocabularyItemId, p.masteryScore]),
            ...grammarProgressList.map((p): [string, number] => [p.grammarConceptId, p.masteryScore]),
        ]);

        const sessionSize = module.practiceSessionSize;
        const minUnseen = Math.ceil(sessionSize * (PRACTICE_MIN_UNSEEN_VOCAB_PERCENT / 100));

        const unseenExercises = allExercises.filter(e => e.vocabularyItemId !== null && !seenVocabIds.has(e.vocabularyItemId!));
        const seenOrGrammarExercises = allExercises.filter(e => e.vocabularyItemId === null || seenVocabIds.has(e.vocabularyItemId!));

        // Step 1: guarantee the minimum unseen-vocab reservation
        const unseenGuaranteed = selectExercises({
            pool: unseenExercises,
            masteryByItemId,
            recentMisses: new Set(),
            targetCount: Math.min(minUnseen, unseenExercises.length),
        });

        // Step 2: fill remaining slots from (leftover unseen) + (seen / grammar) exercises
        const guaranteedIds = new Set(unseenGuaranteed.map(e => e.id));
        const fillerPool = [
            ...unseenExercises.filter(e => !guaranteedIds.has(e.id)),
            ...seenOrGrammarExercises,
        ];
        const stillNeeded = sessionSize - unseenGuaranteed.length;

        const fillerSelected = stillNeeded > 0
            ? selectExercises({ pool: fillerPool, masteryByItemId, recentMisses: new Set(), targetCount: stillNeeded })
            : [];

        const combined = [...unseenGuaranteed, ...fillerSelected];

        combined.sort((a, b) => (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99));

        const now = new Date().toISOString();

        const session = new PracticeSession({
            userId,
            moduleId: req.moduleId,
            exerciseIds: combined.map(e => e.id),
            answers: [],
            currentPosition: 0,
            retryQueue: [],
            startedAt: now,
            completedAt: null,
        });

        const sessionId = await practiceSessionStore.create(session);

        await userModuleProgressStore.transitionStatus(userId, req.moduleId, "in_progress");

        return {
            sessionId,
            moduleId: req.moduleId,
            exerciseIds: combined.map(e => e.id),
            startedAt: now,
        };
    }
}

interface StartPracticeSessionRequest {
    userId: string;
    moduleId: string;
}

interface StartPracticeSessionResponse {
    sessionId: string;
    moduleId: string;
    exerciseIds: string[];
    startedAt: string;
}
