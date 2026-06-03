import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { UserStore } from "../../store/UserStore";
import { UserModuleProgressStore } from "../../store/UserModuleProgressStore";
import { ModuleStore } from "../../store/ModuleStore";
import { CEFR_LEVELS, CefrLevel } from "../../model/CefrLevels";

type ModuleStep = "grammar" | "practice" | "test" | "done";

/**
 * Derives the current step in the module flow from the module's status.
 * 
 * - locked    â†’ null (module not started or not yet unlocked)
 * - available â†’ "grammar" (first step: read the grammar intro)
 * - in_progress â†’ "practice" (grammar done, practice underway)
 *   Note: cannot distinguish "practice" from "test" without F10 session data;
 *   this will be refined when F10 is implemented.
 * - completed â†’ "done"
 */
function deriveStep(status: string): ModuleStep | null {
    switch (status) {
        case "available":   return "grammar";
        case "in_progress": return "practice";
        case "completed":   return "done";
        default:            return null;
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
        const allModules = await new ModuleStore(db).list();
        const allModuleIds = allModules.map(m => m.id);
        const allProgress = await new UserModuleProgressStore({ db, config }).listByUser(user.id, allModuleIds);
        const progressMap = new Map(allProgress.map(p => [p.moduleId, p]));

        // 3. Levels rollup â€” status derived purely from the user's position in the CEFR sequence
        const userLevelIdx = CEFR_LEVELS.indexOf(user.cefrLevel as CefrLevel);

        const levels: LevelSummary[] = CEFR_LEVELS.map((level, idx) => {
            const levelModules = allModules.filter(m => m.cefrLevel === level);
            const modulesTotal = levelModules.length;
            const modulesCompleted = levelModules.filter(
                m => progressMap.get(m.id)?.status === "completed"
            ).length;

            let status: "locked" | "current" | "completed";
            if (idx < userLevelIdx)      status = "completed";
            else if (idx === userLevelIdx) status = "current";
            else                           status = "locked";

            return { level, status, modulesCompleted, modulesTotal };
        });

        // 4. Per-module list for the viewed level
        const viewedModules = allModules.filter(m => m.cefrLevel === viewedLevel);

        const modules: ModuleProgressEntry[] = viewedModules.map(m => {
            const progress = progressMap.get(m.id);
            const status = progress?.status ?? "locked";
            const step = deriveStep(status);
            const completionPct = status === "completed" ? 100 : 0;

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

            return {
                moduleId: m.id,
                title: m.title,
                status,
                step,
                completionPct,
                startedAt: progress?.startedAt ?? null,
                completedAt: progress?.completedAt ?? null,
                testUnlocksAt: null,   // requires F10 practice session completedAt â€” not available yet
                testRetryAvailableAt,
            };
        });

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
    moduleId: string;
    title: string;
    status: string;
    step: ModuleStep | null;
    completionPct: number;
    startedAt: string | null;
    completedAt: string | null;
    testUnlocksAt: string | null;
    testRetryAvailableAt: string | null;
}

interface GetMeProgressResponse {
    currentCefrLevel: string;
    levels: LevelSummary[];
    modules: ModuleProgressEntry[];
}

