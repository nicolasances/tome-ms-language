import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { ExerciseStore } from "../store/ExerciseStore";

export class PatchExerciseTimesShown extends TotoDelegate<PatchExerciseTimesShownRequest, PatchExerciseTimesShownResponse> {

    parseRequest(req: Request): PatchExerciseTimesShownRequest {

        const { id } = req.params;

        return { id };
    }

    async do(req: PatchExerciseTimesShownRequest, _userContext?: UserContext): Promise<PatchExerciseTimesShownResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const store = new ExerciseStore(db);
        const found = await store.incrementTimesShown(req.id);

        if (!found) throw new ValidationError(404, `Exercise not found for id '${req.id}'`);

        return { ok: true };
    }
}

interface PatchExerciseTimesShownRequest {
    id: string;
}

interface PatchExerciseTimesShownResponse {
    ok: boolean;
}
