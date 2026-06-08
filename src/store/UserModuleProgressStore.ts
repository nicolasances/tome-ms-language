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

    async upsert(progress: UserModuleProgress): Promise<UserModuleProgress> {
        await this.db.collection(COLLECTION).replaceOne(
            { userId: progress.userId, moduleId: progress.moduleId },
            progress.toBSON(),
            { upsert: true }
        );
        return progress;
    }

    /**
     * Transitions a module's status (in_progress | completed) for a user, upserting the record.
     *
     * Idempotent timestamps: startedAt is set once on the first in_progress transition and
     * never overwritten; practiceCompletedAt is set once (whenever first provided) and never
     * overwritten. completedAt, vocabularyItemsPracticed and testAttempts carry over from any
     * existing record across transitions.
     *
     * @param userId the user id
     * @param moduleId the module id
     * @param status the new status: "in_progress" or "completed"
     * @param practiceCompletedAt optional ISO timestamp marking full vocabulary coverage (Step 2 complete)
     *
     * @return the upserted progress record
     */
    async transitionStatus(userId: string, moduleId: string, status: "in_progress" | "completed", practiceCompletedAt?: string): Promise<UserModuleProgress> {

        const existing = await this.findByUserAndModule(userId, moduleId);

        const now = new Date().toISOString();

        const updated = new UserModuleProgress({
            userId,
            moduleId,
            status,
            startedAt: status === "in_progress"
                ? (existing?.startedAt ?? now)
                : (existing?.startedAt ?? null),
            completedAt: status === "completed" ? now : (existing?.completedAt ?? null),
            vocabularyItemsPracticed: existing?.vocabularyItemsPracticed ?? [],
            practiceCompletedAt: existing?.practiceCompletedAt ?? practiceCompletedAt ?? null,
            testAttempts: existing?.testAttempts ?? [],
        });

        return this.upsert(updated);
    }

    async appendTestAttempt(userId: string, moduleId: string, attempt: ModuleTestAttempt): Promise<UserModuleProgress | null> {
        const result = await this.db.collection(COLLECTION).updateOne(
            { userId, moduleId },
            { $push: { testAttempts: attempt.toBSON() } } as any
        );
        if (result.matchedCount === 0) return null;
        return this.findByUserAndModule(userId, moduleId);
    }

    /**
     * Adds the given vocabulary item ids to the module's vocabularyItemsPracticed set.
     * Uses set-union semantics ($addToSet) so ids already present are not duplicated.
     *
     * @param userId the user id
     * @param moduleId the module id
     * @param vocabularyItemIds the vocabulary item ids encountered during practice
     *
     * @return the updated progress record, or null if no record exists for (userId, moduleId)
     */
    async appendPracticedVocabulary(userId: string, moduleId: string, vocabularyItemIds: string[]): Promise<UserModuleProgress | null> {

        const result = await this.db.collection(COLLECTION).updateOne(
            { userId, moduleId },
            { $addToSet: { vocabularyItemsPracticed: { $each: vocabularyItemIds } } } as any
        );

        if (result.matchedCount === 0) return null;

        return this.findByUserAndModule(userId, moduleId);
    }
}
