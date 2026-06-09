import { ObjectId, WithId } from "mongodb";

export interface PracticeAnswer {
    exerciseId: string;
    isCorrect: boolean;
    userAnswer: string;
    answeredAt: string;
}

export class PracticeSession {

    id?: string;
    userId: string;
    moduleId: string;
    exerciseIds: string[];
    answers: PracticeAnswer[];
    currentPosition: number;
    retryQueue: string[];
    startedAt: string;
    completedAt: string | null;

    constructor({ id, userId, moduleId, exerciseIds, answers, currentPosition, retryQueue, startedAt, completedAt }: PracticeSessionInput) {

        this.id = id;
        this.userId = userId;
        this.moduleId = moduleId;
        this.exerciseIds = exerciseIds ?? [];
        this.answers = answers ?? [];
        this.currentPosition = currentPosition ?? 0;
        this.retryQueue = retryQueue ?? [];
        this.startedAt = startedAt;
        this.completedAt = completedAt ?? null;
    }

    /**
     * Creates a PracticeSession instance from a MongoDB BSON document.
     */
    static fromBSON(data: WithId<any>): PracticeSession {

        return new PracticeSession({
            id: data._id.toString(),
            userId: data.userId,
            moduleId: data.moduleId,
            exerciseIds: data.exerciseIds ?? [],
            answers: data.answers ?? [],
            currentPosition: data.currentPosition ?? 0,
            retryQueue: data.retryQueue ?? [],
            startedAt: data.startedAt,
            completedAt: data.completedAt ?? null,
        });
    }

    /**
     * Serializes the PracticeSession to a plain object for MongoDB storage.
     * Does not include _id — MongoDB generates it on insert.
     */
    toBSON(): any {

        return {
            userId: this.userId,
            moduleId: this.moduleId,
            exerciseIds: this.exerciseIds,
            answers: this.answers,
            currentPosition: this.currentPosition,
            retryQueue: this.retryQueue,
            startedAt: this.startedAt,
            completedAt: this.completedAt,
        };
    }
}

interface PracticeSessionInput {
    id?: string;
    userId: string;
    moduleId: string;
    exerciseIds?: string[];
    answers?: PracticeAnswer[];
    currentPosition?: number;
    retryQueue?: string[];
    startedAt: string;
    completedAt?: string | null;
}
