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

        const doc = await this.db.collection(USERS_COLLECTION).findOne({ email });

        if (!doc) return null;

        return User.fromBSON(doc as any);
    }

    /**
     * Finds a user by their internal id (the `id` field used across progress records).
     * Returns null if not found.
     *
     * @param {string} userId - The user's internal id.
     *
     * @returns {Promise<User | null>} The user, or null.
     */
    async findById(userId: string): Promise<User | null> {

        const doc = await this.db.collection(USERS_COLLECTION).findOne({ id: userId });

        if (!doc) return null;

        return User.fromBSON(doc as any);
    }

    /**
     * Inserts a new user document. Returns the created user.
     */
    async create(user: User): Promise<User> {

        await this.db.collection(USERS_COLLECTION).insertOne(user.toBSON());

        return user;
    }

    /**
     * Updates the user's CEFR level. Returns the updated user.
     */
    async updateCefrLevel(email: string, newLevel: CefrLevel): Promise<User> {

        const result = await this.db.collection(USERS_COLLECTION).findOneAndUpdate(
            { email },
            { $set: { cefrLevel: newLevel } },
            { returnDocument: "after" }
        );

        if (!result) throw new Error(`User not found for email: ${email}`);

        return User.fromBSON(result as any);
    }
}
