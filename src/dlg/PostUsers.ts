import { randomUUID } from "crypto";
import { Request } from "express";
import { TotoDelegate, UserContext } from "totoms";
import { ControllerConfig } from "../Config";
import { User } from "../model/User";
import { UserStore } from "../store/UserStore";

export class PostUsers extends TotoDelegate<PostUsersRequest, PostUsersResponse> {

    parseRequest(_req: Request): PostUsersRequest {

        return {};
    }

    async do(_req: PostUsersRequest, userContext?: UserContext): Promise<PostUsersResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        const store = new UserStore({ db, config });

        const email = userContext!.email;

        const existing = await store.findByEmail(email);

        if (existing) {

            return { id: existing.id, email: existing.email, cefrLevel: existing.cefrLevel, createdAt: existing.createdAt };
        }

        const user = new User({
            id: randomUUID(),
            email,
            cefrLevel: "A1",
            createdAt: new Date().toISOString(),
        });

        const created = await store.create(user);

        return { id: created.id, email: created.email, cefrLevel: created.cefrLevel, createdAt: created.createdAt };
    }
}

interface PostUsersRequest {}

interface PostUsersResponse {
    id: string;
    email: string;
    cefrLevel: string;
    createdAt: string;
}
