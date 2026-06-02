import { Db } from "mongodb";
import { ControllerConfig } from "../Config";

const COLLECTION = "userModuleProgress";

export class UserModuleProgressStore {

    private db: Db;
    private config: ControllerConfig;

    constructor({ db, config }: { db: Db; config: ControllerConfig }) {
        this.db = db;
        this.config = config;
    }
}
