import { WithId } from "mongodb";
import { CefrLevel } from "./CefrLevels";

export class User {

    id: string;
    email: string;
    cefrLevel: CefrLevel;
    createdAt: string;

    constructor({ id, email, cefrLevel, createdAt }: UserInput) {

        this.id = id;
        this.email = email;
        this.cefrLevel = cefrLevel;
        this.createdAt = createdAt;
    }

    /**
     * Constructs a User instance from a raw MongoDB document.
     */
    static fromBSON(data: WithId<any>): User {

        return new User({
            id: data.id,
            email: data.email,
            cefrLevel: data.cefrLevel,
            createdAt: data.createdAt,
        });
    }

    /**
     * Converts this instance to a plain object suitable for MongoDB storage.
     */
    toBSON(): any {

        return {
            id: this.id,
            email: this.email,
            cefrLevel: this.cefrLevel,
            createdAt: this.createdAt,
        };
    }
}

interface UserInput {
    id: string;
    email: string;
    cefrLevel: CefrLevel;
    createdAt: string;
}
