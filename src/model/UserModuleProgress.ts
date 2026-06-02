import { WithId } from "mongodb";

export const MODULE_STATUSES = ["locked", "available", "in_progress", "completed"] as const;
export type ModuleStatus = typeof MODULE_STATUSES[number];

export class ModuleTestAttempt {

    id: string;
    score: number;
    passed: boolean;
    takenAt: string;

    constructor({ id, score, passed, takenAt }: { id: string; score: number; passed: boolean; takenAt: string }) {
        this.id = id;
        this.score = score;
        this.passed = passed;
        this.takenAt = takenAt;
    }

    static fromBSON(data: any): ModuleTestAttempt {
        return new ModuleTestAttempt({
            id: data.id,
            score: data.score,
            passed: data.passed,
            takenAt: data.takenAt,
        });
    }

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
    testAttempts: ModuleTestAttempt[];

    constructor({ userId, moduleId, status, startedAt, completedAt, testAttempts }: UserModuleProgressInput) {
        this.userId = userId;
        this.moduleId = moduleId;
        this.status = status;
        this.startedAt = startedAt;
        this.completedAt = completedAt;
        this.testAttempts = testAttempts;
    }

    static fromBSON(data: WithId<any>): UserModuleProgress {
        return new UserModuleProgress({
            userId: data.userId,
            moduleId: data.moduleId,
            status: data.status,
            startedAt: data.startedAt ?? null,
            completedAt: data.completedAt ?? null,
            testAttempts: (data.testAttempts ?? []).map((a: any) => ModuleTestAttempt.fromBSON(a)),
        });
    }

    toBSON(): any {
        return {
            userId: this.userId,
            moduleId: this.moduleId,
            status: this.status,
            startedAt: this.startedAt,
            completedAt: this.completedAt,
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
    testAttempts: ModuleTestAttempt[];
}
