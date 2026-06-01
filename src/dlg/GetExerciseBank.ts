import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { ExerciseBank } from "../model/ExerciseBank";
import { ExerciseStore } from "../store/ExerciseStore";

export class GetExerciseBank extends TotoDelegate<GetExerciseBankRequest, GetExerciseBankResponse> {

    parseRequest(req: Request): GetExerciseBankRequest {

        const { moduleId } = req.params;

        return { moduleId };
    }

    async do(req: GetExerciseBankRequest, _userContext?: UserContext): Promise<GetExerciseBankResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const store = new ExerciseStore(db);
        const bank = await store.findBankByModuleId(req.moduleId);

        if (!bank) throw new ValidationError(404, `Exercise bank not found for moduleId '${req.moduleId}'`);

        return { bank };
    }
}

interface GetExerciseBankRequest {
    moduleId: string;
}

interface GetExerciseBankResponse {
    bank: ExerciseBank;
}
