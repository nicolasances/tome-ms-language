import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { UserStore } from "../store/UserStore";
import { ModuleStore } from "../store/ModuleStore";
import { UserModuleProgressStore } from "../store/UserModuleProgressStore";

export class GetMeLevelProgress extends TotoDelegate<GetMeLevelProgressRequest, GetMeLevelProgressResponse> {

    parseRequest(_req: Request): GetMeLevelProgressRequest {
        return {};
    }

    async do(_req: GetMeLevelProgressRequest, userContext?: UserContext): Promise<GetMeLevelProgressResponse> {
        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const user = await new UserStore({ db, config }).findByEmail(userContext!.email);
        if (!user) throw new ValidationError(404, "User profile not found");

        const modules = await new ModuleStore(db).list(user.cefrLevel);
        const moduleIds = modules.map(m => m.id);

        const progressRecords = await new UserModuleProgressStore({ db, config }).listByUser(user.id, moduleIds);
        const progressMap = new Map(progressRecords.map(p => [p.moduleId, p.status]));

        const moduleSummary = modules.map(m => ({
            moduleId: m.id,
            status: progressMap.get(m.id) ?? "locked",
        }));

        const allCompleted = moduleSummary.every(m => m.status === "completed");

        return {
            cefrLevel: user.cefrLevel,
            allCompleted,
            modules: moduleSummary,
        };
    }
}

interface GetMeLevelProgressRequest {}

interface GetMeLevelProgressResponse {
    cefrLevel: string;
    allCompleted: boolean;
    modules: { moduleId: string; status: string }[];
}
