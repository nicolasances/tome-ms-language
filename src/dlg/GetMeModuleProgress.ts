import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { UserStore } from "../store/UserStore";
import { UserModuleProgressStore } from "../store/UserModuleProgressStore";
import { ModuleStore } from "../store/ModuleStore";

export class GetMeModuleProgress extends TotoDelegate<GetMeModuleProgressRequest, GetMeModuleProgressResponse> {

    parseRequest(req: Request): GetMeModuleProgressRequest {
        const cefrLevel = req.query.cefrLevel as string | undefined;
        return { cefrLevel };
    }

    async do(req: GetMeModuleProgressRequest, userContext?: UserContext): Promise<GetMeModuleProgressResponse> {
        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const user = await new UserStore({ db, config }).findByEmail(userContext!.email);
        if (!user) throw new ValidationError(404, "User profile not found");

        const progressStore = new UserModuleProgressStore({ db, config });

        if (req.cefrLevel) {
            const modules = await new ModuleStore(db).list(req.cefrLevel);
            const moduleIds = modules.map(m => m.id);
            const progress = await progressStore.listByUser(user.id, moduleIds);
            return { progress };
        }

        const progress = await progressStore.listByUser(user.id);
        return { progress };
    }
}

interface GetMeModuleProgressRequest {
    cefrLevel?: string;
}

interface GetMeModuleProgressResponse {
    progress: any[];
}
