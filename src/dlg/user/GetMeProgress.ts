import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { UserStore } from "../../store/UserStore";
import { UserModuleProgressStore } from "../../store/UserModuleProgressStore";
import { ModuleStore } from "../../store/ModuleStore";
import { CEFR_LEVELS, CefrLevel } from "../../model/CefrLevels";
import { Module } from "../../model/Module";
import { ModuleProficiency, ProficiencyBasis, UserModuleProgress } from "../../model/UserModuleProgress";
import { FIRST_PRACTICE_RUNG, LAST_PRACTICE_RUNG, PROFICIENCY_VERSION } from "../../Config";
import { computeModuleProficiency } from "../../util/ProficiencyScore";

type ModuleStep = "grammar" | "practice" | "test" | "done";

/**
 * Derives the current step in the module flow from the module’s status.
 *
 * - locked      → null
 * - available   → "grammar"
 * - in_progress → "test" if practiceCompletedAt is set, otherwise "practice"
 * - completed   → "done"
 */
function deriveStep(status: string, practiceCompletedAt?: string | null): ModuleStep | null {
    switch (status) {
        case "available": return "grammar";
        case "in_progress": return practiceCompletedAt ? "test" : "practice";
        case "completed": return "done";
        default: return null;
    }
}

export class GetMeProgress extends TotoDelegate<GetMeProgressRequest, GetMeProgressResponse> {

    parseRequest(req: Request): GetMeProgressRequest {
        const cefrLevel = req.query.cefrLevel as string | undefined;
        return { cefrLevel };
    }

    async do(req: GetMeProgressRequest, userContext?: UserContext): Promise<GetMeProgressResponse> {
        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        // 1. Resolve user
        const user = await new UserStore({ db, config }).findByEmail(userContext!.email);
        if (!user) throw new ValidationError(404, "User profile not found");

        const viewedLevel = req.cefrLevel ?? user.cefrLevel;

        // 2. Load all modules and all progress records in two queries
        const progressStore = new UserModuleProgressStore({ db, config });

        const allModules = await new ModuleStore(db).list();
        const allModuleIds = allModules.map(m => m.id);
        const allProgress = await progressStore.listByUser(user.id, allModuleIds);
        const progressMap = new Map(allProgress.map(p => [p.moduleId, p]));

        // 3. Levels rollup - status derived purely from the user's position in the CEFR sequence
        const userLevelIdx = CEFR_LEVELS.indexOf(user.cefrLevel as CefrLevel);

        const levels: LevelSummary[] = CEFR_LEVELS.map((level, idx) => {
            const levelModules = allModules.filter(m => m.cefrLevel === level);
            const modulesTotal = levelModules.length;
            const modulesCompleted = levelModules.filter(
                m => progressMap.get(m.id)?.status === "completed"
            ).length;

            let status: "locked" | "current" | "completed";
            if (idx < userLevelIdx) status = "completed";
            else if (idx === userLevelIdx) status = "current";
            else status = "locked";

            return { level, status, modulesCompleted, modulesTotal };
        });

        // 4. Per-module list for the viewed level
        // Modules are sorted by ascending id
        const viewedModules = allModules.filter(m => m.cefrLevel === viewedLevel).sort((a, b) => a.id > b.id ? 1 : -1);

        // 5. Lazily backfill the User Proficiency Score of the completed modules that carry none —
        // or one computed by an older formula version. This is the only write this read performs:
        // the score is stored, so the first call after a deploy pays for it and every later call is
        // a plain read. The per-module reads run concurrently because each one is scoped to a
        // single (user, module) pair — there is no bulk form of "the first attempt of each module".
        const staleProgress = viewedModules
            .map(m => progressMap.get(m.id))
            .filter((p): p is UserModuleProgress => p !== undefined && p.status === "completed" && (p.proficiency === null || p.proficiency.version < PROFICIENCY_VERSION));

        const backfilled = new Map<string, ModuleProficiency | null>(await Promise.all(staleProgress.map(async p => {

            const proficiency = await computeModuleProficiency({ db, config, userId: user.id, moduleId: p.moduleId, passNumber: p.passNumber, completedAt: p.completedAt ?? undefined });

            if (proficiency) await progressStore.setProficiency(user.id, p.moduleId, proficiency);

            return [p.moduleId, proficiency] as [string, ModuleProficiency | null];
        })));

        // 6. Build the per-module entries
        const modules: ModuleProgressEntry[] = [];

        let previousModule: Module | null = null;
        for (let idx = 0; idx < viewedModules.length; idx++) {

            const m = viewedModules[idx];
            
            const progress = progressMap.get(m.id);

            let status = progress?.status;

            if (!status) {

                if (!previousModule) status = "available"; // First module of the level is available if no progress record exists
                else {
                    const previousProgress = progressMap.get(previousModule.id);
                    
                    if (!previousProgress) status = "locked"; // Previous module has no progress record, so this one is locked
                    // Previous module is completed, or was completed at least once and is now mid re-practice
                    // (F25 — passNumber >= 2): either way this one stays available. Without the passNumber
                    // check, resetting an earlier module would re-lock a later one the user had already earned.
                    else if (previousProgress.status === "completed" || previousProgress.passNumber >= 2) status = "available";
                    else status = "locked"; // Previous module is not completed, so this one is locked
                }

            }

            const step = deriveStep(status, progress?.practiceCompletedAt);

            // Vocabulary coverage across all rungs of the practice ladder (F10). A module completed
            // before the ladder shipped carries no rung coverage at all, so it is reported as fully
            // covered rather than reading as 0% on the module map.
            const coveredItemIds = progress?.coveredItemIds() ?? new Set<string>();
            const vocabularyItemsPracticedCount = status === "completed" ? m.vocabularyItemIds.length : m.vocabularyItemIds.filter(id => coveredItemIds.has(id)).length;
            const completionPct = m.vocabularyItemIds.length > 0 ? Math.round((vocabularyItemsPracticedCount / m.vocabularyItemIds.length) * 100) : 0;

            // Per-rung practice-ladder progress (F10). Modules completed before the ladder shipped
            // carry no rungCoverage at all, so — same fallback as vocabularyItemsPracticedCount above —
            // they are reported as sitting past the last rung, fully covered.
            const currentRung = progress?.currentRung ?? FIRST_PRACTICE_RUNG;
            const modulePracticeItemIds = [...m.vocabularyItemIds, ...m.grammarConceptIds];
            const currentRungCoveredIds = new Set(progress?.coverageAt(currentRung)?.itemIds ?? []);
            const currentRungCoveredCount = status === "completed" ? modulePracticeItemIds.length : modulePracticeItemIds.filter(id => currentRungCoveredIds.has(id)).length;
            const fullyCompletedRungs = (status === "completed" || progress?.practiceCompletedAt) ? LAST_PRACTICE_RUNG : currentRung - 1;

            // testUnlocksAt: practiceCompletedAt (Step 2 complete) + module unlock delay; null until Step 2 completes
            let testUnlocksAt: string | null = null;
            if (progress?.practiceCompletedAt) {
                const unlockAt = new Date(progress.practiceCompletedAt);
                unlockAt.setHours(unlockAt.getHours() + m.testUnlockDelayHours);
                testUnlocksAt = unlockAt.toISOString();
            }

            // testRetryAvailableAt: last failed attempt's takenAt + module retry delay
            let testRetryAvailableAt: string | null = null;
            if (progress && progress.testAttempts.length > 0) {
                const failedAttempts = progress.testAttempts.filter(a => !a.passed);
                if (failedAttempts.length > 0) {
                    const lastFailed = failedAttempts[failedAttempts.length - 1];
                    const retryAt = new Date(lastFailed.takenAt);
                    retryAt.setMinutes(retryAt.getMinutes() + m.testRetryDelayMinutes);
                    testRetryAvailableAt = retryAt.toISOString();
                }
            }

            // The frozen User Proficiency Score — how hard this module actually was. Only a
            // completed module has one; a completed module the user never tested (no submitted
            // attempt to score) reports null too.
            const proficiency = backfilled.has(m.id) ? backfilled.get(m.id)! : (progress?.proficiency ?? null);

            modules.push({
                moduleId: m.id,
                title: m.title,
                status,
                step,
                completionPct,
                proficiency: status === "completed" && proficiency ? { score: proficiency.score, testScore: proficiency.testScore, practiceScore: proficiency.practiceScore, basis: proficiency.basis } : null,
                startedAt: progress?.startedAt ?? null,
                completedAt: progress?.completedAt ?? null,
                testUnlocksAt,
                testRetryAvailableAt,
                vocabularyItemsPracticedCount,
                currentRung,
                currentRungCoverage: { coveredCount: currentRungCoveredCount, totalCount: modulePracticeItemIds.length },
                fullyCompletedRungs,
            });

            previousModule = m;
        };

        return { currentCefrLevel: user.cefrLevel, levels, modules };
    }
}

interface GetMeProgressRequest {
    cefrLevel?: string;
}

interface LevelSummary {
    level: string;
    status: "locked" | "current" | "completed";
    modulesCompleted: number;
    modulesTotal: number;
}

interface ModuleProgressEntry {
    moduleId: string;                           // The module's unique identifier
    title: string;                              // The module's display title
    status: string;                             // Module status: locked | available | in_progress | completed
    step: ModuleStep | null;                    // Current step within the module flow; null when locked
    completionPct: number;                      // Overall module completion percentage (0 or 100)
    proficiency: ModuleProficiencyEntry | null; // How hard the module actually was (F07/UPS); null for any module that is not completed, or completed without a scoreable test attempt
    startedAt: string | null;                   // ISO-8601 timestamp of when the user first started the module
    completedAt: string | null;                 // ISO-8601 timestamp of when the module was completed
    testUnlocksAt: string | null;               // ISO-8601 timestamp of when the Module Test unlocks; null until Step 2 coverage is complete
    testRetryAvailableAt: string | null;        // ISO-8601 timestamp of when a failed test retry becomes available; null when no failed attempts exist
    vocabularyItemsPracticedCount: number;      // Number of the module's vocabulary items covered at any rung of the practice ladder; the module's full vocabulary count once it is completed
    currentRung: number;                        // The practice-ladder rung (1–3) the module is currently practising at; defaults to the first rung when no progress record exists
    currentRungCoverage: RungCoverageCount;      // Coverage of the module's combined practice items (vocabulary + grammar concepts) at currentRung; fully covered once the module is completed
    fullyCompletedRungs: number;                 // Number of rungs fully completed before currentRung; 3 once the whole ladder (or a pre-ladder module) is complete
}

interface ModuleProficiencyEntry {
    score: number;                  // The User Proficiency Score (0–100): lower means the module was harder work
    testScore: number;              // The test component: the first submitted attempt with errors charged ×3 (0–100)
    practiceScore: number | null;   // The practice component: rung-weighted accuracy over the practice sessions (0–100); null when the module holds no weighted practice answers
    basis: ProficiencyBasis;        // Which inputs the score could be computed from — a "test-only" score must not be read as a flawless practice run
}

interface RungCoverageCount {
    coveredCount: number;   // Practice items covered at the rung
    totalCount: number;     // Practice items in the module — the count that must be reached to complete the rung
}

interface GetMeProgressResponse {
    currentCefrLevel: string;
    levels: LevelSummary[];
    modules: ModuleProgressEntry[];
}

