import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { Module } from "../model/Module";
import { ModuleStore } from "../store/ModuleStore";

export class GetModule extends TotoDelegate<GetModuleRequest, Module> {

    parseRequest(req: Request): GetModuleRequest {

        const id = req.params.id;

        if (!id) throw new ValidationError(400, "id is required");

        return { id };
    }

    async do(req: GetModuleRequest, _userContext?: UserContext): Promise<Module> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const store = new ModuleStore(db);
        const module = await store.findById(req.id);

        if (!module) throw new ValidationError(404, `Module with id '${req.id}' not found`);

        return module;
    }
}

interface GetModuleRequest {
    id: string;
}
