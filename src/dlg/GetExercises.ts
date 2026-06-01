import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { Exercise } from "../model/Exercise";
import { ExerciseStore } from "../store/ExerciseStore";

export class GetExercises extends TotoDelegate<GetExercisesRequest, GetExercisesResponse> {

    parseRequest(req: Request): GetExercisesRequest {

        const moduleId = req.query?.moduleId as string | undefined;

        if (!moduleId) throw new ValidationError(400, "moduleId query parameter is required");

        return { moduleId };
    }

    async do(req: GetExercisesRequest, _userContext?: UserContext): Promise<GetExercisesResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const store = new ExerciseStore(db);
        const exercises = await store.listByModuleId(req.moduleId);

        return { exercises };
    }
}

interface GetExercisesRequest {
    moduleId: string;
}

interface GetExercisesResponse {
    exercises: Exercise[];
}
