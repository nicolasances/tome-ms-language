import { Db } from "mongodb";
import { ControllerConfig } from "../Config";
import { CefrLevel } from "../model/CefrLevels";
import { User } from "../model/User";

const USERS_COLLECTION = "users";

export class UserStore {

    private db: Db;

    constructor({ db }: { db: Db; config: ControllerConfig }) {

        this.db = db;
    }

    /**
     * Finds a user by their email address. Returns null if not found.
     */
    async findByEmail(email: string): Promise<User | null> {

        throw new Error("Not implemented");
    }

    /**
     * Inserts a new user document. Returns the created user.
     */
    async create(user: User): Promise<User> {

        throw new Error("Not implemented");
    }

    /**
     * Updates the user's CEFR level. Returns the updated user.
     */
    async updateCefrLevel(email: string, newLevel: CefrLevel): Promise<User> {

        throw new Error("Not implemented");
    }
}
