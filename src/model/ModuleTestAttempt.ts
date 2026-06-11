import { WithId } from "mongodb";
import { ExerciseResult } from "./ExerciseResult";

/**
 * A single answer submitted by the user during a module test.
 * The first answer to each exercise is final for grading — there is no retry queue.
 */
export interface TestAnswer {
    exerciseId: string;     // The id of the exercise that was answered
    isCorrect: boolean;     // Whether the answer was judged correct by the normalised matcher (may be flipped by F13 AI verification)
    userAnswer: string;     // The raw answer string submitted by the user
    answeredAt: string;     // ISO-8601 timestamp of when the answer was submitted
}

/**
 * A stateful, resumable Module Test attempt (F11).
 *
 * Lifecycle: created on POST .../tests → answers accumulated via POST .../answers
 * → finalised on POST .../submit (takenAt set, score/passed computed).
 * While takenAt is null the attempt is in-progress and can be resumed.
 *
 * The full document lives in the `moduleTestAttempts` collection.
 * On submit, a lightweight TestAttemptRecord summary is also embedded in
 * UserModuleProgress.testAttempts[] for eligibility checks and history display.
 */
export class ModuleTestAttempt {

    id?: string;                        // MongoDB _id as a hex string; absent before first save
    userId: string;                     // The user who owns this attempt
    moduleId: string;                   // The module being tested
    exerciseIds: string[];              // Ordered list of exercise ids for this attempt (set at start, never changed)
    answers: TestAnswer[];              // All answers submitted so far — one per exercise, first answer is final
    currentPosition: number;            // 0-based index of the next unanswered exercise
    verifiedExerciseIds: string[];      // Exercise ids for which AI answer verification (F13) was already used this attempt
    score: number | null;               // Percentage correct (0–100); null until the attempt is submitted
    passed: boolean | null;             // Whether score >= testPassThreshold; null until the attempt is submitted
    startedAt: string;                  // ISO-8601 timestamp of when the attempt was started
    takenAt: string | null;             // ISO-8601 timestamp of submission; null while in-progress
    exerciseResults: ExerciseResult[];  // Per-exercise mastery results (F06); populated on submit

    constructor({ id, userId, moduleId, exerciseIds, answers, currentPosition, verifiedExerciseIds, score, passed, startedAt, takenAt, exerciseResults }: ModuleTestAttemptInput) {

        this.id = id;
        this.userId = userId;
        this.moduleId = moduleId;
        this.exerciseIds = exerciseIds ?? [];
        this.answers = answers ?? [];
        this.currentPosition = currentPosition ?? 0;
        this.verifiedExerciseIds = verifiedExerciseIds ?? [];
        this.score = score ?? null;
        this.passed = passed ?? null;
        this.startedAt = startedAt;
        this.takenAt = takenAt ?? null;
        this.exerciseResults = exerciseResults ?? [];
    }

    /**
     * Creates a ModuleTestAttempt from a raw MongoDB BSON document.
     */
    static fromBSON(data: WithId<any>): ModuleTestAttempt {

        return new ModuleTestAttempt({
            id: data._id.toString(),
            userId: data.userId,
            moduleId: data.moduleId,
            exerciseIds: data.exerciseIds ?? [],
            answers: data.answers ?? [],
            currentPosition: data.currentPosition ?? 0,
            verifiedExerciseIds: data.verifiedExerciseIds ?? [],
            score: data.score ?? null,
            passed: data.passed ?? null,
            startedAt: data.startedAt,
            takenAt: data.takenAt ?? null,
            exerciseResults: (data.exerciseResults ?? []).map((r: any) => ExerciseResult.fromBSON(r)),
        });
    }

    /**
     * Serializes the attempt to a plain object for MongoDB storage.
     * Does not include _id — MongoDB generates it on insert.
     */
    toBSON(): any {

        return {
            userId: this.userId,
            moduleId: this.moduleId,
            exerciseIds: this.exerciseIds,
            answers: this.answers,
            currentPosition: this.currentPosition,
            verifiedExerciseIds: this.verifiedExerciseIds,
            score: this.score,
            passed: this.passed,
            startedAt: this.startedAt,
            takenAt: this.takenAt,
            exerciseResults: this.exerciseResults.map(r => r.toBSON()),
        };
    }
}

interface ModuleTestAttemptInput {
    id?: string;
    userId: string;
    moduleId: string;
    exerciseIds?: string[];
    answers?: TestAnswer[];
    currentPosition?: number;
    verifiedExerciseIds?: string[];
    score?: number | null;
    passed?: boolean | null;
    startedAt: string;
    takenAt?: string | null;
    exerciseResults?: ExerciseResult[];
}
