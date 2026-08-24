import { Db } from "mongodb";
import { ControllerConfig, FIRST_PRACTICE_RUNG, LAST_PRACTICE_RUNG } from "../Config";
import { UserModuleProgress, ModuleProficiency, RungCoverage, TestAttemptRecord } from "../model/UserModuleProgress";

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
     * **`completed` is terminal — but only against this method.** A module that has been passed
     * is never moved back to `in_progress` here: re-entering it via "Keep practising" starts a
     * session, which would otherwise un-complete it, hiding it from F21's level-test gate (which
     * requires every module at the level to be `completed`) and re-showing the module test on the
     * dashboard. This guard is not a defense against re-practice (F25): a genuine reset
     * un-completes the module on purpose, and does so through `resetForRePractice`, a dedicated
     * operation that bypasses this guard entirely rather than relaxing it.
     *
     * Idempotent timestamps: startedAt is set once on the first in_progress transition and
     * never overwritten; practiceCompletedAt is set once (whenever first provided) and never
     * overwritten. currentRung, rungCoverage, testAttempts and passNumber carry over from any
     * existing record across transitions — passNumber in particular must survive this, since a
     * re-practised module (F25) starts its new pass through this same method, and every session
     * or attempt created afterwards is stamped from it.
     *
     * @param userId the user id
     * @param moduleId the module id
     * @param requestedStatus the status to move to: "in_progress" or "completed"
     * @param practiceCompletedAt optional ISO timestamp marking completion of the whole practice ladder (rung 3 covered)
     *
     * @return the upserted progress record
     */
    async transitionStatus(userId: string, moduleId: string, requestedStatus: "in_progress" | "completed", practiceCompletedAt?: string): Promise<UserModuleProgress> {

        const existing = await this.findByUserAndModule(userId, moduleId);

        const now = new Date().toISOString();

        const status = existing?.status === "completed" ? "completed" : requestedStatus;

        const updated = new UserModuleProgress({
            userId,
            moduleId,
            status,
            startedAt: status === "in_progress"
                ? (existing?.startedAt ?? now)
                : (existing?.startedAt ?? null),
            // Keyed off the requested status, not the effective one: a practice start on an already
            // completed module must leave completedAt where it was, not restamp it to now.
            completedAt: requestedStatus === "completed" ? now : (existing?.completedAt ?? null),
            currentRung: existing?.currentRung,
            rungCoverage: existing?.rungCoverage ?? [],
            practiceCompletedAt: existing?.practiceCompletedAt ?? practiceCompletedAt ?? null,
            testAttempts: existing?.testAttempts ?? [],
            passNumber: existing?.passNumber,
        });

        return this.upsert(updated);
    }

    /**
     * Stores the User Proficiency Score on a user's module progress record.
     *
     * Written once, when the module completes, and refreshed only when the formula version moves
     * — the score is a frozen snapshot of the first pass through the module. Only the
     * `proficiency` field is touched, so it is safe to call on a record another flow is reading.
     *
     * @param {string} userId - The user id.
     * @param {string} moduleId - The module id.
     * @param {ModuleProficiency} proficiency - The computed score to store.
     *
     * @returns {Promise<boolean>} True when a progress record was matched and updated.
     */
    async setProficiency(userId: string, moduleId: string, proficiency: ModuleProficiency): Promise<boolean> {

        const result = await this.db.collection(COLLECTION).updateOne(
            { userId, moduleId },
            { $set: { proficiency: proficiency.toBSON() } } as any
        );

        return result.matchedCount > 0;
    }

    /**
     * Resets a completed module's progress record for a new pass (F25 — Module Re-practice).
     *
     * Deliberately un-completes the module, bypassing `transitionStatus`'s "completed is
     * terminal" guard through this dedicated operation rather than relaxing it: `status` returns
     * to `available`, `startedAt`/`completedAt`/`practiceCompletedAt` are cleared, the ladder
     * restarts at `currentRung` = `FIRST_PRACTICE_RUNG` with `rungCoverage` emptied, and
     * `passNumber` is incremented. `testAttempts` and `proficiency` are left untouched — they are
     * the pass history and the score the new pass will replace, not state this reset owns.
     *
     * Callers must have already verified the module is `completed` and quiet (no open practice
     * session or test attempt); this method performs no precondition checks of its own.
     *
     * @param {string} userId - The user id.
     * @param {string} moduleId - The module id.
     *
     * @returns {Promise<UserModuleProgress | null>} The reset record, or null if no progress record exists for (userId, moduleId).
     */
    async resetForRePractice(userId: string, moduleId: string): Promise<UserModuleProgress | null> {

        const existing = await this.findByUserAndModule(userId, moduleId);

        if (!existing) return null;

        const result = await this.db.collection(COLLECTION).updateOne(
            { userId, moduleId },
            {
                $set: {
                    status: "available",
                    startedAt: null,
                    completedAt: null,
                    currentRung: FIRST_PRACTICE_RUNG,
                    rungCoverage: [],
                    practiceCompletedAt: null,
                    passNumber: existing.passNumber + 1,
                },
            } as any
        );

        if (result.matchedCount === 0) return null;

        return this.findByUserAndModule(userId, moduleId);
    }

    async appendTestAttempt(userId: string, moduleId: string, attempt: TestAttemptRecord): Promise<UserModuleProgress | null> {
        const result = await this.db.collection(COLLECTION).updateOne(
            { userId, moduleId },
            { $push: { testAttempts: attempt.toBSON() } } as any
        );
        if (result.matchedCount === 0) return null;
        return this.findByUserAndModule(userId, moduleId);
    }

    /**
     * Records practice items — vocabulary items and/or grammar concepts — as covered at a given
     * rung of the practice ladder (F10).
     *
     * Uses set-union semantics ($addToSet) so ids already covered at that rung are not duplicated.
     * The rung's coverage entry is created on first append and never cleared afterwards, so each
     * rung keeps its own history.
     *
     * @param userId the user id
     * @param moduleId the module id
     * @param rung the rung the items were covered at (1–3)
     * @param itemIds the ids of the practice items served an exercise of that rung
     *
     * @return the updated progress record, or null if no record exists for (userId, moduleId)
     */
    async appendRungCoverage(userId: string, moduleId: string, rung: number, itemIds: string[]): Promise<UserModuleProgress | null> {

        if (itemIds.length === 0) return this.findByUserAndModule(userId, moduleId);

        const appended = await this.db.collection(COLLECTION).updateOne(
            { userId, moduleId, "rungCoverage.rung": rung },
            { $addToSet: { "rungCoverage.$.itemIds": { $each: itemIds } } } as any
        );

        // No entry for this rung yet — create it. Happens once per rung, on its first session.
        if (appended.matchedCount === 0) {

            const created = await this.db.collection(COLLECTION).updateOne(
                { userId, moduleId },
                { $push: { rungCoverage: new RungCoverage({ rung, itemIds: [...new Set(itemIds)] }).toBSON() } } as any
            );

            if (created.matchedCount === 0) return null;
        }

        return this.findByUserAndModule(userId, moduleId);
    }

    /**
     * Marks a rung phase as fully covered and advances the module to the next rung (F10).
     *
     * Idempotent: the update only matches a rung whose completedAt is still null, so a later
     * session at the same rung cannot move the timestamp or re-advance the module. That matters
     * at the last rung, where currentRung stops climbing and further sessions keep re-detecting
     * full coverage.
     *
     * @param userId the user id
     * @param moduleId the module id
     * @param rung the rung that has just been fully covered (1–3)
     * @param completedAt ISO timestamp of when the rung was completed
     *
     * @return the updated progress record, or null if the record does not exist or the rung was already completed
     */
    async completeRung(userId: string, moduleId: string, rung: number, completedAt: string): Promise<UserModuleProgress | null> {

        const result = await this.db.collection(COLLECTION).updateOne(
            { userId, moduleId, rungCoverage: { $elemMatch: { rung, completedAt: null } } },
            { $set: { "rungCoverage.$.completedAt": completedAt, currentRung: Math.min(rung + 1, LAST_PRACTICE_RUNG) } } as any
        );

        if (result.matchedCount === 0) return null;

        return this.findByUserAndModule(userId, moduleId);
    }
}
