import { WithId } from "mongodb";
import { ExerciseResult } from "./ExerciseResult";
import { TestAnswer } from "./ModuleTestAttempt";

/**
 * A stateful, resumable Level Test attempt (F21).
 *
 * The Level Test is a graded parallel of the practice session (F10) / module test (F11),
 * scoped to a full CEFR level rather than a single module. Lifecycle:
 * created on POST .../levelTests → answers accumulated via POST .../levelTests/:id/answers
 * → finalised on POST .../levelTests/:id/submit (takenAt set, score/passed computed).
 * While takenAt is null the attempt is in-progress and can be resumed.
 *
 * The full document lives in the `levelTestAttempts` collection. Unlike the module test,
 * there is no per-module progress doc: the most recent submitted attempt for a
 * (userId, cefrLevel) pair is queried directly to enforce the inter-attempt cooldown.
 */
export class LevelTestAttempt {

    id?: string;                        // MongoDB _id as a hex string; absent before first save
    userId: string;                     // The user who owns this attempt
    cefrLevel: string;                  // The CEFR level being tested (A1..C2)
    exerciseIds: string[];              // Ordered list of exercise ids for this attempt (set at start, never changed)
    answers: TestAnswer[];              // All answers submitted so far — one per exercise, first answer is final
    currentPosition: number;            // 0-based index of the next unanswered exercise
    verifiedExerciseIds: string[];      // Exercise ids for which AI answer verification (F13) was already used this attempt
    score: number | null;               // Percentage correct (0–100); null until the attempt is submitted
    passed: boolean | null;             // Whether score >= LEVEL_TEST_PASS_THRESHOLD; null until the attempt is submitted
    startedAt: string;                  // ISO-8601 timestamp of when the attempt was started
    takenAt: string | null;             // ISO-8601 timestamp of submission; null while in-progress
    exerciseResults: ExerciseResult[];  // Per-exercise mastery results (F06); populated on submit

    constructor({ id, userId, cefrLevel, exerciseIds, answers, currentPosition, verifiedExerciseIds, score, passed, startedAt, takenAt, exerciseResults }: LevelTestAttemptInput) {

        this.id = id;
        this.userId = userId;
        this.cefrLevel = cefrLevel;
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
     * Creates a LevelTestAttempt from a raw MongoDB BSON document.
     *
     * @param {WithId<any>} data - The BSON document read from MongoDB.
     *
     * @returns {LevelTestAttempt} The reconstructed attempt instance.
     */
    static fromBSON(data: WithId<any>): LevelTestAttempt {

        return new LevelTestAttempt({
            id: data._id.toString(),
            userId: data.userId,
            cefrLevel: data.cefrLevel,
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
     *
     * @returns {any} The BSON-ready plain object.
     */
    toBSON(): any {

        return {
            userId: this.userId,
            cefrLevel: this.cefrLevel,
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

export interface LevelTestAttemptInput {
    id?: string;                            // MongoDB _id as a hex string; absent before first save
    userId: string;                         // The user who owns this attempt
    cefrLevel: string;                      // The CEFR level being tested
    exerciseIds?: string[];                 // Ordered list of exercise ids for this attempt
    answers?: TestAnswer[];                 // Answers submitted so far
    currentPosition?: number;               // 0-based index of the next unanswered exercise
    verifiedExerciseIds?: string[];         // Exercise ids AI-verified this attempt (F13)
    score?: number | null;                  // Percentage correct (0–100); null until submitted
    passed?: boolean | null;                // Whether the attempt passed; null until submitted
    startedAt: string;                      // ISO-8601 timestamp of when the attempt was started
    takenAt?: string | null;                // ISO-8601 submission timestamp; null while in-progress
    exerciseResults?: ExerciseResult[];     // Per-exercise mastery results; populated on submit
}
