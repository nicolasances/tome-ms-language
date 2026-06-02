import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ObjectId } from "mongodb";
import { ControllerConfig } from "../Config";
import { UserStore } from "../store/UserStore";
import { UserModuleProgressStore } from "../store/UserModuleProgressStore";
import { ModuleTestAttempt } from "../model/UserModuleProgress";

export class PostMeModuleTestAttempt extends TotoDelegate<PostMeModuleTestAttemptRequest, PostMeModuleTestAttemptResponse> {

    parseRequest(req: Request): PostMeModuleTestAttemptRequest {
        const moduleId = req.params.moduleId;
        if (!moduleId) throw new ValidationError(400, "moduleId is required");

        const { score, passed } = req.body ?? {};

        if (score === undefined || score === null) throw new ValidationError(400, "score is required");
        if (typeof score !== "number" || score < 0 || score > 100) throw new ValidationError(400, "score must be a number between 0 and 100");
        if (passed === undefined || passed === null) throw new ValidationError(400, "passed is required");

        return { moduleId, score, passed };
    }

    async do(req: PostMeModuleTestAttemptRequest, userContext?: UserContext): Promise<PostMeModuleTestAttemptResponse> {
        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const user = await new UserStore({ db, config }).findByEmail(userContext!.email);
        if (!user) throw new ValidationError(404, "User profile not found");

        const store = new UserModuleProgressStore({ db, config });
        const existing = await store.findByUserAndModule(user.id, req.moduleId);
        if (!existing) throw new ValidationError(404, "Progress record not found");

        const attempt = new ModuleTestAttempt({
            id: new ObjectId().toString(),
            score: req.score,
            passed: req.passed,
            takenAt: new Date().toISOString(),
        });

        await store.appendTestAttempt(user.id, req.moduleId, attempt);

        return { id: attempt.id, moduleId: req.moduleId };
    }
}

interface PostMeModuleTestAttemptRequest {
    moduleId: string;
    score: number;
    passed: boolean;
}

interface PostMeModuleTestAttemptResponse {
    id: string;
    moduleId: string;
}
