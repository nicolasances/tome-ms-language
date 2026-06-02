import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { UserStore } from "../store/UserStore";
import { UserModuleProgressStore } from "../store/UserModuleProgressStore";
import { UserModuleProgress } from "../model/UserModuleProgress";

export class GetMeModuleProgressForModule extends TotoDelegate<GetMeModuleProgressForModuleRequest, GetMeModuleProgressForModuleResponse> {

    parseRequest(req: Request): GetMeModuleProgressForModuleRequest {
        const moduleId = req.params.moduleId;
        if (!moduleId) throw new ValidationError(400, "moduleId is required");
        return { moduleId };
    }

    async do(req: GetMeModuleProgressForModuleRequest, userContext?: UserContext): Promise<GetMeModuleProgressForModuleResponse> {
        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const user = await new UserStore({ db, config }).findByEmail(userContext!.email);
        if (!user) throw new ValidationError(404, "User profile not found");

        const progress = await new UserModuleProgressStore({ db, config }).findByUserAndModule(user.id, req.moduleId);
        if (!progress) throw new ValidationError(404, "Progress record not found");

        return { progress };
    }
}

interface GetMeModuleProgressForModuleRequest {
    moduleId: string;
}

interface GetMeModuleProgressForModuleResponse {
    progress: UserModuleProgress;
}
