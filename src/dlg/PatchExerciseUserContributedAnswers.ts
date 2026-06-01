import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { ExerciseStore } from "../store/ExerciseStore";

export class PatchExerciseUserContributedAnswers extends TotoDelegate<PatchRequest, PatchResponse> {

    parseRequest(req: Request): PatchRequest {

        const { id } = req.params;
        const { answer } = req.body ?? {};

        if (!answer) throw new ValidationError(400, "answer is required");

        return { id, answer };
    }

    async do(req: PatchRequest, _userContext?: UserContext): Promise<PatchResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const store = new ExerciseStore(db);
        const found = await store.appendUserContributedAnswer(req.id, req.answer);

        if (!found) throw new ValidationError(404, `Exercise not found for id '${req.id}'`);

        return { ok: true };
    }
}

interface PatchRequest {
    id: string;
    answer: string;
}

interface PatchResponse {
    ok: boolean;
}
