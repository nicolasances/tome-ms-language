import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { Exercise } from "../../model/Exercise";
import { ExerciseStore } from "../../store/ExerciseStore";

export class GetExercise extends TotoDelegate<GetExerciseRequest, GetExerciseResponse> {

    parseRequest(req: Request): GetExerciseRequest {

        const { id } = req.params;

        return { id };
    }

    async do(req: GetExerciseRequest, _userContext?: UserContext): Promise<GetExerciseResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const store = new ExerciseStore(db);
        const exercise = await store.findById(req.id);

        if (!exercise) throw new ValidationError(404, `Exercise not found for id '${req.id}'`);

        return { exercise };
    }
}

interface GetExerciseRequest {
    id: string;
}

interface GetExerciseResponse {
    exercise: Exercise;
}

