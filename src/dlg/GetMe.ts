import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { UserStore } from "../store/UserStore";

export class GetMe extends TotoDelegate<GetMeRequest, GetMeResponse> {

    parseRequest(_req: Request): GetMeRequest {

        return {};
    }

    async do(_req: GetMeRequest, userContext?: UserContext): Promise<GetMeResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        const store = new UserStore({ db, config });

        const email = userContext!.email;

        const user = await store.findByEmail(email);

        if (!user) throw new ValidationError(404, "User profile not found");

        return { id: user.id, email: user.email, cefrLevel: user.cefrLevel, createdAt: user.createdAt };
    }
}

interface GetMeRequest {}

interface GetMeResponse {
    id: string;
    email: string;
    cefrLevel: string;
    createdAt: string;
}
