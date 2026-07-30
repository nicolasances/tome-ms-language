import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig, FIRST_PRACTICE_RUNG, LAST_PRACTICE_RUNG } from "../../Config";
import { ExerciseResult } from "../../model/ExerciseResult";
import { ExerciseStore } from "../../store/ExerciseStore";
import { ModuleStore } from "../../store/ModuleStore";
import { PracticeSessionStore } from "../../store/PracticeSessionStore";
import { UserGrammarConceptProgressStore } from "../../store/UserGrammarConceptProgressStore";
import { UserModuleProgressStore } from "../../store/UserModuleProgressStore";
import { UserVocabularyProgressStore } from "../../store/UserVocabularyProgressStore";
import { linkedItemIdOf, rungOfType } from "../../util/PracticeRungs";

/**
 * Raised when `/complete` is called while the session still holds exercises the user has not
 * answered correctly — the missed-retry loop (F10) has not been driven to the end.
 *
 * Carries the outstanding exercise ids so the client can resume the retry loop on exactly those,
 * rather than having to diff the session state itself.
 */
class IncompleteSessionError extends ValidationError {

    outstandingExerciseIds: string[];

    constructor(outstandingExerciseIds: string[]) {
        super(400, `Session cannot be completed: ${outstandingExerciseIds.length} exercise(s) have not been answered correctly yet`);
        this.outstandingExerciseIds = outstandingExerciseIds;
    }
}

export class CompletePracticeSession extends TotoDelegate<CompletePracticeSessionRequest, CompletePracticeSessionResponse> {

    parseRequest(req: Request): CompletePracticeSessionRequest {

        const userId = req.params.userId;
        const sessionId = req.params.sessionId;

        if (!userId) throw new ValidationError(400, "userId is required");
        if (!sessionId) throw new ValidationError(400, "sessionId is required");

        return { userId, sessionId };
    }

    /**
     * Completes a practice session and advances the module along the practice ladder (F10).
     *
     * Business logic:
     * - Mastery (F06) is updated for every attempted exercise, including the retry-queue repeats.
     * - Every practice item — vocabulary item or grammar concept — served an exercise of the
     *   module's current rung is recorded as covered at that rung.
     * - When every practice item in the module is covered at the current rung, the rung phase
     *   completes and the module advances to the next rung. There is no spacing between rungs.
     * - When the last rung completes, `practiceCompletedAt` is set, which starts the module test
     *   unlock countdown (F11). It is idempotent — later "keep practising" sessions do not move it.
     *
     * @param {CompletePracticeSessionRequest} req - The user id and the session to complete.
     *
     * @returns {CompletePracticeSessionResponse} The ladder state before and after this session.
     */
    async do(req: CompletePracticeSessionRequest, userContext?: UserContext): Promise<CompletePracticeSessionResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const sessionStore = new PracticeSessionStore({ db, config });

        const session = await sessionStore.findById(req.sessionId);

        if (!session) throw new ValidationError(404, `Practice session ${req.sessionId} not found`);
        if (session.completedAt !== null) throw new ValidationError(400, "Session is already completed");

        const exerciseStore = new ExerciseStore(db);
        const vocabProgressStore = new UserVocabularyProgressStore({ db, config });
        const grammarProgressStore = new UserGrammarConceptProgressStore({ db, config });
        const userModuleProgressStore = new UserModuleProgressStore({ db, config });
        const moduleStore = new ModuleStore(db);

        const now = new Date().toISOString();

        const exercises = await exerciseStore.findByIds(session.exerciseIds);
        const exerciseById = new Map(exercises.map(e => [e.id, e]));

        // An exercise counts as correct when it has at least one correct answer, or when F13
        // accepted the answer — verification records the id in verifiedExerciseIds rather than
        // flipping isCorrect on a practice session.
        const correctlyAnsweredExerciseIds = new Set([
            ...session.answers.filter(a => a.isCorrect).map(a => a.exerciseId),
            ...session.verifiedExerciseIds,
        ]);

        // The missed-retry loop (F10) must have been driven to the end before a session may close:
        // it is what makes "covered at a rung" mean "produced correctly at that rung", which is the
        // guarantee the whole ladder rests on. It cannot be evidenced from retryQueue — that array
        // only ever grows, since SubmitPracticeAnswer pushes on every wrong answer and nothing pulls
        // on a correct retry — so it is checked against the session's own answer log instead.
        //
        // Rejecting rather than partially crediting keeps the request atomic: nothing below has run
        // yet, so a refused completion writes neither mastery nor coverage. The client recovers
        // through the ordinary flow — answer the outstanding exercises, call complete again.
        const outstandingExerciseIds = session.exerciseIds.filter(id => !correctlyAnsweredExerciseIds.has(id));

        if (outstandingExerciseIds.length > 0) throw new IncompleteSessionError(outstandingExerciseIds);

        // Update mastery for every attempt in the session (retry-queue repeats included)
        for (const answer of session.answers) {

            const exercise = exerciseById.get(answer.exerciseId);

            if (!exercise) continue;

            const result = new ExerciseResult({
                exerciseId: exercise.id,
                type: exercise.type,
                isCorrect: answer.isCorrect,
                userAnswer: answer.userAnswer,
                correctAnswer: exercise.answer,
                timestamp: answer.answeredAt,
                moduleId: session.moduleId,
            });

            if (exercise.vocabularyItemId) await vocabProgressStore.appendResultAndRecompute(req.userId, exercise.vocabularyItemId, result);
            else if (exercise.grammarConceptId) await grammarProgressStore.appendResultAndRecompute(req.userId, exercise.grammarConceptId, result);
        }

        const progressBefore = await userModuleProgressStore.findByUserAndModule(req.userId, session.moduleId);
        const module = await moduleStore.findById(session.moduleId);

        const currentRung = progressBefore?.currentRung ?? FIRST_PRACTICE_RUNG;
        const rungWasAlreadyComplete = progressBefore?.coverageAt(currentRung)?.completedAt != null;

        const modulePracticeItemIds = module ? [...module.vocabularyItemIds, ...module.grammarConceptIds] : [];
        const coveredBefore = new Set(progressBefore?.coverageAt(currentRung)?.itemIds ?? []);

        // An item is covered at rung r when it was served a tier-r exercise and answered correctly.
        // The correctness filter is redundant given the precondition checked above — by here every
        // exercise in the session is correct — but it keeps the coverage write self-evidently right
        // rather than depending on a guard forty lines away.
        const coveredThisSession = [...new Set(exercises.filter(e => rungOfType(e.type) === currentRung && correctlyAnsweredExerciseIds.has(e.id)).map(e => linkedItemIdOf(e)))];

        const progressAfter = await userModuleProgressStore.appendRungCoverage(req.userId, session.moduleId, currentRung, coveredThisSession);

        const coveredAfter = new Set(progressAfter?.coverageAt(currentRung)?.itemIds ?? []);

        const rungCompleted = !rungWasAlreadyComplete && modulePracticeItemIds.length > 0 && modulePracticeItemIds.every(id => coveredAfter.has(id));
        const ladderCompleted = rungCompleted && currentRung === LAST_PRACTICE_RUNG;

        if (rungCompleted) {

            await userModuleProgressStore.completeRung(req.userId, session.moduleId, currentRung, now);

            // The whole ladder is done — start the module test unlock countdown (F11)
            if (ladderCompleted) await userModuleProgressStore.transitionStatus(req.userId, session.moduleId, "in_progress", now);
        }

        await sessionStore.complete(req.sessionId, now);

        const moduleVocabIds = module?.vocabularyItemIds ?? [];
        const allCoveredItemIds = progressAfter?.coveredItemIds() ?? new Set<string>();
        const vocabCoveredCount = moduleVocabIds.filter(id => allCoveredItemIds.has(id)).length;

        const rungsCompletedBefore = progressBefore?.completedRungCount() ?? 0;

        return {
            currentRung: rungCompleted ? Math.min(currentRung + 1, LAST_PRACTICE_RUNG) : currentRung,
            previousRung: currentRung,
            rungCompleted,
            ladderCompleted,
            rungsCompletedBefore,
            rungsCompletedAfter: rungCompleted ? rungsCompletedBefore + 1 : rungsCompletedBefore,
            rungCoverageBefore: { rung: currentRung, coveredCount: coveredBefore.size, totalCount: modulePracticeItemIds.length },
            rungCoverageAfter: { rung: currentRung, coveredCount: coveredAfter.size, totalCount: modulePracticeItemIds.length },
            vocabularyCoverage: { coveredCount: vocabCoveredCount, totalCount: moduleVocabIds.length },
            step2Complete: ladderCompleted,
            unseenVocabCount: moduleVocabIds.length - vocabCoveredCount,
        };
    }
}

interface CompletePracticeSessionRequest {
    userId: string;     // The id of the user completing the session.
    sessionId: string;  // The id of the practice session to complete.
}

/**
 * Coverage of one rung at a point in time: how many of the module's practice items are covered.
 */
interface RungCoverageSummary {
    rung: number;          // The rung this summary describes (1–3).
    coveredCount: number;  // Practice items (vocabulary + grammar) covered at that rung.
    totalCount: number;    // Practice items in the module — the count that must be reached to complete the rung.
}

/**
 * Module-wide coverage of vocabulary items across all rungs — the practice recap's inner ring.
 */
interface VocabularyCoverageSummary {
    coveredCount: number;  // Distinct vocabulary items covered at any rung.
    totalCount: number;    // Vocabulary items in the module.
}

interface CompletePracticeSessionResponse {
    currentRung: number;                          // The rung the module is at after this session (1–3).
    previousRung: number;                         // The rung this session was practised at.
    rungCompleted: boolean;                       // Whether this session completed the rung phase.
    ladderCompleted: boolean;                     // Whether this session completed the last rung, and so the whole practice ladder.
    rungsCompletedBefore: number;                 // Rungs fully covered before this session — the recap's outer ring start value.
    rungsCompletedAfter: number;                  // Rungs fully covered after this session — the recap's outer ring end value.
    rungCoverageBefore: RungCoverageSummary;      // Current-rung coverage before this session.
    rungCoverageAfter: RungCoverageSummary;       // Current-rung coverage after this session.
    vocabularyCoverage: VocabularyCoverageSummary; // Module-wide vocabulary coverage across all rungs — the recap's inner ring.
    step2Complete: boolean;                       // Alias of ladderCompleted, kept for clients predating the practice ladder.
    unseenVocabCount: number;                     // Vocabulary items not yet covered at any rung, kept for clients predating the practice ladder.
}
