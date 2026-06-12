import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { CEFR_LEVELS } from "../../model/CefrLevels";
import { LevelTestBank } from "../../model/LevelTestBank";
import { LevelTestBankStore } from "../../store/LevelTestBankStore";

export class GetLevelTestBank extends TotoDelegate<GetLevelTestBankRequest, GetLevelTestBankResponse> {

    /**
     * Parses cefrLevel from path params and validates it against the supported CEFR levels.
     */
    parseRequest(req: Request): GetLevelTestBankRequest {

        const { cefrLevel } = req.params;

        if (!cefrLevel || !(CEFR_LEVELS as readonly string[]).includes(cefrLevel)) throw new ValidationError(400, `cefrLevel must be one of: ${CEFR_LEVELS.join(", ")}`);

        return { cefrLevel };
    }

    /**
     * Returns the level test bank (metadata + exerciseIds) for the given CEFR level.
     * Rejects with 404 if no bank exists for the level.
     */
    async do(req: GetLevelTestBankRequest, _userContext?: UserContext): Promise<GetLevelTestBankResponse> {

        const config = this.config as ControllerConfig;

        const db = await config.getMongoDb(config.getDBName());

        const store = new LevelTestBankStore(db);

        const bank = await store.findByCefrLevel(req.cefrLevel);

        if (!bank) throw new ValidationError(404, `No level test bank found for level '${req.cefrLevel}'`);

        return { bank };
    }
}

interface GetLevelTestBankRequest {
    cefrLevel: string;          // The CEFR level whose bank is requested.
}

interface GetLevelTestBankResponse {
    bank: LevelTestBank;        // The level test bank for the requested level.
}
