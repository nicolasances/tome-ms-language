import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { UserStore } from "../../store/UserStore";
import { UserModuleProgressStore } from "../../store/UserModuleProgressStore";
import { UserModuleProgress } from "../../model/UserModuleProgress";

export class PutMeModuleProgress extends TotoDelegate<PutMeModuleProgressRequest, PutMeModuleProgressResponse> {

    parseRequest(req: Request): PutMeModuleProgressRequest {
        const moduleId = req.params.moduleId;
        if (!moduleId) throw new ValidationError(400, "moduleId is required");

        const { status } = req.body ?? {};
        if (!status || !["in_progress", "completed"].includes(status)) {
            throw new ValidationError(400, "status must be one of: in_progress, completed");
        }

        return { moduleId, status };
    }

    async do(req: PutMeModuleProgressRequest, userContext?: UserContext): Promise<PutMeModuleProgressResponse> {
        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const user = await new UserStore({ db, config }).findByEmail(userContext!.email);
        if (!user) throw new ValidationError(404, "User profile not found");

        const store = new UserModuleProgressStore({ db, config });
        const existing = await store.findByUserAndModule(user.id, req.moduleId);

        const now = new Date().toISOString();

        const updated = new UserModuleProgress({
            userId: user.id,
            moduleId: req.moduleId,
            status: req.status as any,
            startedAt: req.status === "in_progress"
                ? (existing?.startedAt ?? now)
                : (existing?.startedAt ?? null),
            completedAt: req.status === "completed" ? now : (existing?.completedAt ?? null),
            testAttempts: existing?.testAttempts ?? [],
        });

        await store.upsert(updated);

        return { moduleId: req.moduleId, status: req.status };
    }
}

interface PutMeModuleProgressRequest {
    moduleId: string;
    status: string;
}

interface PutMeModuleProgressResponse {
    moduleId: string;
    status: string;
}

