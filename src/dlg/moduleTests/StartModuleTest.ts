import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { MODULE_TEST_SIZE, TEST_RETRY_DELAY_MINUTES, TEST_UNLOCK_DELAY_HOURS } from "../../Config";
import { ControllerConfig } from "../../Config";
import { ModuleTestAttempt } from "../../model/ModuleTestAttempt";
import { ExerciseStore } from "../../store/ExerciseStore";
import { ModuleStore } from "../../store/ModuleStore";
import { ModuleTestAttemptStore } from "../../store/ModuleTestAttemptStore";
import { UserGrammarConceptProgressStore } from "../../store/UserGrammarConceptProgressStore";
import { UserModuleProgressStore } from "../../store/UserModuleProgressStore";
import { UserVocabularyProgressStore } from "../../store/UserVocabularyProgressStore";
import { selectExercises } from "../../util/ExerciseSelector";
import { ClientTestExercise, toClientTestExercise } from "../../util/TestExercisePresentation";

/**
 * Thrown when an active (un-submitted) test attempt already exists for the user + module.
 * The client must resume the existing attempt via GET …/moduleTests/:attemptId.
 */
class ActiveAttemptError extends ValidationError {

    attemptId: string;  // The id of the already-active attempt to resume

    constructor(attemptId: string) {
        super(409, "An active module test attempt already exists for this module");
        this.attemptId = attemptId;
    }
}

/**
 * Starts a new Module Test attempt for the given user and module (F11).
 *
 * Business rules enforced:
 * - 404 if the module does not exist.
 * - 400 if Step 2 is not complete (`practiceCompletedAt` is null).
 * - 400 if the test unlock delay has not elapsed since `practiceCompletedAt`.
 * - 400 if the module is already `completed` (OQ-03: no retakes).
 * - 400 if a failed attempt's retry delay has not yet elapsed.
 * - 409 (with `attemptId`) if an active (un-submitted) attempt already exists.
 * - Otherwise: draws 20 exercises via F08 (unconstrained — no fresh/repeat split),
 *   creates the attempt, and returns the questions without correct answers.
 */
export class StartModuleTest extends TotoDelegate<StartModuleTestRequest, StartModuleTestResponse> {

    /**
     * Extracts userId and moduleId from the route parameters.
     */
    parseRequest(req: Request): StartModuleTestRequest {

        const userId = req.params.userId;
        const moduleId = req.params.moduleId;

        if (!userId) throw new ValidationError(400, "userId is required");
        if (!moduleId) throw new ValidationError(400, "moduleId is required");

        return { userId, moduleId, now: new Date() };
    }

    /**
     * Creates a new Module Test attempt after verifying all eligibility conditions.
     * Returns the 20 selected exercises without their correct answers.
     */
    async do(req: StartModuleTestRequest, _userContext?: UserContext): Promise<StartModuleTestResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        const now = req.now;

        const moduleStore = new ModuleStore(db);
        const module = await moduleStore.findById(req.moduleId);

        if (!module) throw new ValidationError(404, `Module ${req.moduleId} not found`);

        const progressStore = new UserModuleProgressStore({ db, config });
        const progress = await progressStore.findByUserAndModule(req.userId, req.moduleId);

        if (!progress?.practiceCompletedAt) {
            throw new ValidationError(400, "Step 2 is not complete — practiceCompletedAt is not set");
        }

        if (progress.status === "completed") {
            throw new ValidationError(400, "Module is already completed — no retakes allowed");
        }

        const testUnlocksAt = new Date(new Date(progress.practiceCompletedAt).getTime() + TEST_UNLOCK_DELAY_HOURS * 60 * 60 * 1000);

        if (now < testUnlocksAt) {
            throw new ValidationError(400, `Test is not yet unlocked — unlocks at ${testUnlocksAt.toISOString()}`);
        }

        const failedAttempts = progress.testAttempts.filter(a => !a.passed && a.takenAt);
        const mostRecentFailed = failedAttempts.sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime())[0];

        if (mostRecentFailed) {

            const retryAvailableAt = new Date(new Date(mostRecentFailed.takenAt).getTime() + TEST_RETRY_DELAY_MINUTES * 60 * 1000);

            if (now < retryAvailableAt) {
                throw new ValidationError(400, `Retry not yet available — retry after ${retryAvailableAt.toISOString()}`);
            }
        }

        const attemptStore = new ModuleTestAttemptStore({ db, config });
        const existing = await attemptStore.findActiveByUserAndModule(req.userId, req.moduleId);

        if (existing) throw new ActiveAttemptError(existing.id!);

        const exerciseStore = new ExerciseStore(db);
        const allExercises = await exerciseStore.listByModuleId(req.moduleId);

        const vocabProgressStore = new UserVocabularyProgressStore({ db, config });
        const grammarProgressStore = new UserGrammarConceptProgressStore({ db, config });

        const vocabProgressList = await vocabProgressStore.listByUser(req.userId, module.vocabularyItemIds);
        const grammarProgressList = await grammarProgressStore.listByUser(req.userId, module.grammarConceptIds);

        const masteryByItemId = new Map<string, number>([
            ...vocabProgressList.map((p): [string, number] => [p.vocabularyItemId, p.masteryScore]),
            ...grammarProgressList.map((p): [string, number] => [p.grammarConceptId, p.masteryScore]),
        ]);

        // F08 unconstrained selection — no fresh/repeat split, no coverage override
        const selected = selectExercises({
            pool: allExercises,
            masteryByItemId,
            recentMisses: new Set(),
            targetCount: MODULE_TEST_SIZE,
        });

        const startedAt = now.toISOString();

        const attempt = new ModuleTestAttempt({
            userId: req.userId,
            moduleId: req.moduleId,
            exerciseIds: selected.map(e => e.id),
            answers: [],
            currentPosition: 0,
            verifiedExerciseIds: [],
            score: null,
            passed: null,
            startedAt,
            takenAt: null,
            exerciseResults: [],
        });

        const attemptId = await attemptStore.create(attempt);

        // Strip correct answers (and expose multiple_choice choices) before returning to the client
        const exercisesWithoutAnswers = selected.map(e => toClientTestExercise(e));

        return { attemptId, moduleId: req.moduleId, exercises: exercisesWithoutAnswers, startedAt };
    }
}

interface StartModuleTestRequest {
    userId: string;     // The user id
    moduleId: string;   // The module id
    now: Date;          // The current time (injectable for testability)
}

interface StartModuleTestResponse {
    attemptId: string;      // The id of the newly created attempt
    moduleId: string;       // The module id
    exercises: ClientTestExercise[];    // Selected exercises without correct answers (multiple_choice carry `choices`)
    startedAt: string;      // ISO-8601 timestamp of when the attempt was started
}
