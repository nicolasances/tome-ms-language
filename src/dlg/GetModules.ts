import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { CEFR_LEVELS, Module } from "../model/Module";
import { ModuleStore } from "../store/ModuleStore";

export class GetModules extends TotoDelegate<GetModulesRequest, GetModulesResponse> {

    parseRequest(req: Request): GetModulesRequest {

        const cefrLevel = req.query.cefrLevel as string | undefined;
        const isUserGeneratedParam = req.query.isUserGenerated as string | undefined;

        if (cefrLevel && !(CEFR_LEVELS as readonly string[]).includes(cefrLevel)) throw new ValidationError(400, `cefrLevel must be one of: ${CEFR_LEVELS.join(", ")}`);

        let isUserGenerated: boolean | undefined;

        if (isUserGeneratedParam === "true") isUserGenerated = true;
        else if (isUserGeneratedParam === "false") isUserGenerated = false;

        return { cefrLevel, isUserGenerated };
    }

    async do(req: GetModulesRequest, _userContext?: UserContext): Promise<GetModulesResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const store = new ModuleStore(db);
        const modules = await store.list(req.cefrLevel, req.isUserGenerated);

        return { modules };
    }
}

interface GetModulesRequest {
    cefrLevel?: string;
    isUserGenerated?: boolean;
}

interface GetModulesResponse {
    modules: Module[];
}
