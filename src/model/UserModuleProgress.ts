import { WithId } from "mongodb";

export const MODULE_STATUSES = ["locked", "available", "in_progress", "completed"] as const;
export type ModuleStatus = typeof MODULE_STATUSES[number];

/**
 * Lightweight summary of a completed Module Test attempt, embedded in UserModuleProgress.testAttempts[].
 * Holds only the grading outcome and timing needed for eligibility checks and history display.
 * The full stateful attempt document lives in the `moduleTestAttempts` collection (see ModuleTestAttempt model).
 */
export class TestAttemptRecord {

    id: string;         // The MongoDB _id (as hex string) of the full ModuleTestAttempt document
    score: number;      // Percentage correct (0–100)
    passed: boolean;    // Whether the attempt passed (score >= testPassThreshold)
    takenAt: string;    // ISO-8601 timestamp of when the attempt was submitted

    constructor({ id, score, passed, takenAt }: { id: string; score: number; passed: boolean; takenAt: string }) {

        this.id = id;
        this.score = score;
        this.passed = passed;
        this.takenAt = takenAt;
    }

    /**
     * Creates a TestAttemptRecord from a raw BSON document.
     */
    static fromBSON(data: any): TestAttemptRecord {

        return new TestAttemptRecord({
            id: data.id,
            score: data.score,
            passed: data.passed,
            takenAt: data.takenAt,
        });
    }

    /**
     * Serializes the record to a plain object for MongoDB storage (embedded in UserModuleProgress).
     */
    toBSON(): any {

        return {
            id: this.id,
            score: this.score,
            passed: this.passed,
            takenAt: this.takenAt,
        };
    }
}

export class UserModuleProgress {

    userId: string;
    moduleId: string;
    status: ModuleStatus;
    startedAt: string | null;
    completedAt: string | null;
    vocabularyItemsPracticed: string[];
    practiceCompletedAt: string | null;
    testAttempts: TestAttemptRecord[];

    constructor({ userId, moduleId, status, startedAt, completedAt, vocabularyItemsPracticed, practiceCompletedAt, testAttempts }: UserModuleProgressInput) {
        this.userId = userId;
        this.moduleId = moduleId;
        this.status = status;
        this.startedAt = startedAt;
        this.completedAt = completedAt;
        this.vocabularyItemsPracticed = vocabularyItemsPracticed ?? [];
        this.practiceCompletedAt = practiceCompletedAt ?? null;
        this.testAttempts = testAttempts;
    }

    static fromBSON(data: WithId<any>): UserModuleProgress {
        return new UserModuleProgress({
            userId: data.userId,
            moduleId: data.moduleId,
            status: data.status,
            startedAt: data.startedAt ?? null,
            completedAt: data.completedAt ?? null,
            vocabularyItemsPracticed: data.vocabularyItemsPracticed ?? [],
            practiceCompletedAt: data.practiceCompletedAt ?? null,
            testAttempts: (data.testAttempts ?? []).map((a: any) => TestAttemptRecord.fromBSON(a)),
        });
    }

    toBSON(): any {
        return {
            userId: this.userId,
            moduleId: this.moduleId,
            status: this.status,
            startedAt: this.startedAt,
            completedAt: this.completedAt,
            vocabularyItemsPracticed: this.vocabularyItemsPracticed,
            practiceCompletedAt: this.practiceCompletedAt,
            testAttempts: this.testAttempts.map(a => a.toBSON()),
        };
    }
}

interface UserModuleProgressInput {
    userId: string;
    moduleId: string;
    status: ModuleStatus;
    startedAt: string | null;
    completedAt: string | null;
    vocabularyItemsPracticed?: string[];
    practiceCompletedAt?: string | null;
    testAttempts: TestAttemptRecord[];
}
