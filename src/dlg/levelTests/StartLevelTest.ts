import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig, LEVEL_TEST_RETRY_DELAY_MINUTES, LEVEL_TEST_SIZE } from "../../Config";
import { Exercise } from "../../model/Exercise";
import { LevelTestAttempt } from "../../model/LevelTestAttempt";
import { ExerciseStore } from "../../store/ExerciseStore";
import { LevelTestAttemptStore } from "../../store/LevelTestAttemptStore";
import { LevelTestBankStore } from "../../store/LevelTestBankStore";
import { ModuleStore } from "../../store/ModuleStore";
import { UserGrammarConceptProgressStore } from "../../store/UserGrammarConceptProgressStore";
import { UserModuleProgressStore } from "../../store/UserModuleProgressStore";
import { UserStore } from "../../store/UserStore";
import { UserVocabularyProgressStore } from "../../store/UserVocabularyProgressStore";
import { selectExercises } from "../../util/ExerciseSelector";

/**
 * Thrown when an active (un-submitted) Level Test attempt already exists for the user + level.
 * The client must resume the existing attempt via GET …/levelTests/:attemptId.
 */
class ActiveAttemptError extends ValidationError {

    attemptId: string;  // The id of the already-active attempt to resume

    constructor(attemptId: string) {
        super(409, "An active level test attempt already exists for this level");
        this.attemptId = attemptId;
    }
}

/**
 * Starts a new Level Test attempt for the given user at their current CEFR level (F21).
 *
 * Business rules enforced:
 * - 404 if the user does not exist.
 * - 409 (with `attemptId`) if an active (un-submitted) attempt already exists (resume it).
 * - 400 if not all curated (non-user-generated) modules at the level are `completed`.
 * - 400 if the 30-minute cooldown since the most recent submitted attempt has not elapsed.
 * - 404 if no level test bank exists for the level.
 * - Otherwise: draws 40 exercises from the level bank via F08 using a level-wide mastery map
 *   (lowest-mastery items prioritized), creates the attempt, and returns the questions without answers.
 */
export class StartLevelTest extends TotoDelegate<StartLevelTestRequest, StartLevelTestResponse> {

    /**
     * Extracts userId from the route parameters.
     */
    parseRequest(req: Request): StartLevelTestRequest {

        const userId = req.params.userId;

        if (!userId) throw new ValidationError(400, "userId is required");

        return { userId, now: new Date() };
    }

    /**
     * Creates a new Level Test attempt after verifying all eligibility conditions.
     * Returns the 40 selected exercises (full objects, same shape as a practice session) without answers.
     *
     * @param {StartLevelTestRequest} req - The userId and current time.
     *
     * @returns {Promise<StartLevelTestResponse>} The created attempt id, level, and selected exercises.
     */
    async do(req: StartLevelTestRequest, _userContext?: UserContext): Promise<StartLevelTestResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        const now = req.now;

        const user = await new UserStore({ db, config }).findById(req.userId);

        if (!user) throw new ValidationError(404, `User ${req.userId} not found`);

        const cefrLevel = user.cefrLevel;

        const attemptStore = new LevelTestAttemptStore({ db, config });

        const active = await attemptStore.findActiveByUserAndLevel(req.userId, cefrLevel);

        if (active) throw new ActiveAttemptError(active.id!);

        // Eligibility: all curated modules at the level must be completed
        const curatedModules = await new ModuleStore(db).list(cefrLevel, false);

        if (curatedModules.length === 0) {
            throw new ValidationError(400, `No curated modules exist for level ${cefrLevel}`);
        }

        const progressList = await new UserModuleProgressStore({ db, config }).listByUser(req.userId, curatedModules.map(m => m.id));
        const completedModuleIds = new Set(progressList.filter(p => p.status === "completed").map(p => p.moduleId));

        if (!curatedModules.every(m => completedModuleIds.has(m.id))) {
            throw new ValidationError(400, `Not all curated modules at level ${cefrLevel} are completed`);
        }

        // Cooldown: 30 minutes must have elapsed since the most recent submitted attempt
        const mostRecent = await attemptStore.findMostRecentSubmittedByUserAndLevel(req.userId, cefrLevel);

        if (mostRecent?.takenAt) {

            const retryAvailableAt = new Date(new Date(mostRecent.takenAt).getTime() + LEVEL_TEST_RETRY_DELAY_MINUTES * 60 * 1000);

            if (now < retryAvailableAt) {
                throw new ValidationError(400, `Cooldown not elapsed — retry after ${retryAvailableAt.toISOString()}`);
            }
        }

        // Load the level bank and its exercises
        const bank = await new LevelTestBankStore(db).findByCefrLevel(cefrLevel);

        if (!bank) throw new ValidationError(404, `No level test bank found for level ${cefrLevel}`);

        const exerciseStore = new ExerciseStore(db);
        const bankExercises = await exerciseStore.findByIds(bank.exerciseIds);

        // Build a level-wide mastery map from the user's progress on every item the bank's exercises link to,
        // so F08 prioritizes the lowest-mastery vocabulary and grammar items.
        const vocabIds = [...new Set(bankExercises.map(e => e.vocabularyItemId).filter((id): id is string => !!id))];
        const grammarIds = [...new Set(bankExercises.map(e => e.grammarConceptId).filter((id): id is string => !!id))];

        const vocabProgressList = await new UserVocabularyProgressStore({ db, config }).listByUser(req.userId, vocabIds);
        const grammarProgressList = await new UserGrammarConceptProgressStore({ db, config }).listByUser(req.userId, grammarIds);

        const masteryByItemId = new Map<string, number>([
            ...vocabProgressList.map((p): [string, number] => [p.vocabularyItemId, p.masteryScore]),
            ...grammarProgressList.map((p): [string, number] => [p.grammarConceptId, p.masteryScore]),
        ]);

        const selected = selectExercises({
            pool: bankExercises,
            masteryByItemId,
            recentMisses: new Set(),
            targetCount: LEVEL_TEST_SIZE,
        });

        const startedAt = now.toISOString();

        const attempt = new LevelTestAttempt({
            userId: req.userId,
            cefrLevel,
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

        // Return the full exercise objects — identical payload/shape to a practice session, since the
        // frontend reuses the same exercise components.
        return { attemptId, cefrLevel, exercises: selected, startedAt };
    }
}

interface StartLevelTestRequest {
    userId: string;     // The user id
    now: Date;          // The current time (injectable for testability)
}

interface StartLevelTestResponse {
    attemptId: string;      // The id of the newly created attempt
    cefrLevel: string;      // The CEFR level being tested
    exercises: Exercise[];  // Selected exercises — full objects, same shape as a practice session
    startedAt: string;      // ISO-8601 timestamp of when the attempt was started
}
