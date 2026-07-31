import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { FIRST_PRACTICE_RUNG, PRACTICE_MIN_UNSEEN_VOCAB_PERCENT } from "../../Config";
import { ControllerConfig } from "../../Config";
import { Exercise } from "../../model/Exercise";
import { PracticeSession } from "../../model/PracticeSession";
import { ExerciseStore } from "../../store/ExerciseStore";
import { ModuleStore } from "../../store/ModuleStore";
import { PracticeSessionStore } from "../../store/PracticeSessionStore";
import { UserGrammarConceptProgressStore } from "../../store/UserGrammarConceptProgressStore";
import { UserModuleProgressStore } from "../../store/UserModuleProgressStore";
import { UserVocabularyProgressStore } from "../../store/UserVocabularyProgressStore";
import { selectExercises } from "../../util/ExerciseSelector";
import { exercisesAtRung, linkedItemIdOf } from "../../util/PracticeRungs";

/**
 * Type-progression order for exercises within a practice session (F10).
 * Lower index = shown earlier (recognition before production).
 *
 * A session only ever holds exercises of one rung, so this now only orders the two types
 * that share a rung; the recognition → production progression across rungs is the ladder itself.
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

        const currentRung = progress?.currentRung ?? FIRST_PRACTICE_RUNG;
        const coveredItemIds = new Set(progress?.coverageAt(currentRung)?.itemIds ?? []);

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

        // The rung pre-filter: a session draws only from the tier the module is practising at.
        const rungPool = exercisesAtRung(allExercises, currentRung);

        if (rungPool.length === 0) throw new ValidationError(400, `Module ${req.moduleId} has no exercise at rung ${currentRung} — its exercise bank cannot support the practice ladder`);

        // "Unseen" is scoped per rung: an item covered at rung 1 is still uncovered at rung 2.
        const uncoveredExercises = rungPool.filter(e => !coveredItemIds.has(linkedItemIdOf(e)));
        const coveredExercises = rungPool.filter(e => coveredItemIds.has(linkedItemIdOf(e)));

        // Step 1: guarantee the minimum reservation for items not yet covered at this rung
        const unseenGuaranteed = selectExercises({
            pool: uncoveredExercises,
            masteryByItemId,
            recentMisses: new Set(),
            targetCount: Math.min(minUnseen, uncoveredExercises.length),
        });

        // Step 2: fill the remaining slots from (leftover uncovered) + (already covered) exercises.
        // There is no tail top-up — the session is always a full sessionSize, including a rung's last.
        const guaranteedIds = new Set(unseenGuaranteed.map(e => e.id));
        const fillerPool = [
            ...uncoveredExercises.filter(e => !guaranteedIds.has(e.id)),
            ...coveredExercises,
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
            exercises: combined,
            currentRung,
            startedAt: now,
        };
    }
}

interface StartPracticeSessionRequest {
    userId: string;
    moduleId: string;
}

interface StartPracticeSessionResponse {
    sessionId: string;         // The id of the newly created practice session.
    moduleId: string;          // The id of the module this session belongs to.
    exercises: Exercise[];     // The full exercise objects selected for this session, ordered by type progression. All belong to currentRung.
    currentRung: number;       // The practice-ladder rung (1–3) this session was drawn at.
    startedAt: string;         // ISO 8601 timestamp of when the session was started.
}
