import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { isValidCefrLevel, nextLevel } from "../../model/CefrLevels";
import { UserStore } from "../../store/UserStore";

export class PutMeCefrLevel extends TotoDelegate<PutMeCefrLevelRequest, PutMeCefrLevelResponse> {

    parseRequest(req: Request): PutMeCefrLevelRequest {

        const { cefrLevel } = req.body ?? {};

        if (!cefrLevel) throw new ValidationError(400, "cefrLevel is required");
        if (!isValidCefrLevel(cefrLevel)) throw new ValidationError(400, `cefrLevel must be one of: A1, A2, B1, B2, C1, C2`);

        return { cefrLevel };
    }

    async do(req: PutMeCefrLevelRequest, userContext?: UserContext): Promise<PutMeCefrLevelResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        const store = new UserStore({ db, config });

        const email = userContext!.email;

        const user = await store.findByEmail(email);

        if (!user) throw new ValidationError(404, "User profile not found");

        const next = nextLevel(user.cefrLevel);

        if (!next) throw new ValidationError(400, "User is already at the highest level");

        if (req.cefrLevel !== next) throw new ValidationError(400, "Level must be the immediate next tier");

        const updated = await store.updateCefrLevel(email, req.cefrLevel);

        return { id: updated.id, email: updated.email, cefrLevel: updated.cefrLevel, createdAt: updated.createdAt };
    }
}

interface PutMeCefrLevelRequest {
    cefrLevel: string;
}

interface PutMeCefrLevelResponse {
    id: string;
    email: string;
    cefrLevel: string;
    createdAt: string;
}

