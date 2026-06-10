import { ObjectId, WithId } from "mongodb";

export interface PracticeAnswer {
    exerciseId: string;     // The id of the exercise that was answered
    isCorrect: boolean;     // Whether the answer was judged correct by the normalised matcher
    userAnswer: string;     // The raw answer string submitted by the user
    answeredAt: string;     // ISO-8601 timestamp of when the answer was submitted
}

export class PracticeSession {

    id?: string;                        // MongoDB _id as a hex string; absent before first save
    userId: string;                     // The user who owns this session
    moduleId: string;                   // The module being practiced
    exerciseIds: string[];              // Ordered list of exercise ids for the primary pass
    answers: PracticeAnswer[];          // All answers submitted so far (primary + retry passes)
    currentPosition: number;            // Index into the current pass (primary or retry queue)
    retryQueue: string[];               // Exercise ids the user answered wrong during the primary pass
    verifiedExerciseIds: string[];      // Exercise ids for which AI answer verification was already used this session (one-per-attempt guard)
    startedAt: string;                  // ISO-8601 timestamp of session start
    completedAt: string | null;         // ISO-8601 timestamp of completion, or null if still active

    constructor({ id, userId, moduleId, exerciseIds, answers, currentPosition, retryQueue, verifiedExerciseIds, startedAt, completedAt }: PracticeSessionInput) {

        this.id = id;
        this.userId = userId;
        this.moduleId = moduleId;
        this.exerciseIds = exerciseIds ?? [];
        this.answers = answers ?? [];
        this.currentPosition = currentPosition ?? 0;
        this.retryQueue = retryQueue ?? [];
        this.verifiedExerciseIds = verifiedExerciseIds ?? [];
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
            verifiedExerciseIds: data.verifiedExerciseIds ?? [],
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
            verifiedExerciseIds: this.verifiedExerciseIds,
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
    verifiedExerciseIds?: string[];
    startedAt: string;
    completedAt?: string | null;
}
