import { Db } from "mongodb";
import { ControllerConfig } from "../Config";
import { UserModuleProgress, ModuleTestAttempt } from "../model/UserModuleProgress";

const COLLECTION = "userModuleProgress";

export class UserModuleProgressStore {

    private db: Db;
    private config: ControllerConfig;

    constructor({ db, config }: { db: Db; config: ControllerConfig }) {
        this.db = db;
        this.config = config;
    }

    async findByUserAndModule(userId: string, moduleId: string): Promise<UserModuleProgress | null> {
        const doc = await this.db.collection(COLLECTION).findOne({ userId, moduleId });
        if (!doc) return null;
        return UserModuleProgress.fromBSON(doc);
    }

    async listByUser(userId: string, moduleIds?: string[]): Promise<UserModuleProgress[]> {
        const filter: Record<string, any> = { userId };
        if (moduleIds) filter.moduleId = { $in: moduleIds };
        const docs = await this.db.collection(COLLECTION).find(filter).toArray();
        return docs.map(doc => UserModuleProgress.fromBSON(doc));
    }
}
