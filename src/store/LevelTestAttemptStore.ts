import { Db, ObjectId } from "mongodb";
import { ControllerConfig } from "../Config";
import { LevelTestAttempt } from "../model/LevelTestAttempt";
import { TestAnswer } from "../model/ModuleTestAttempt";
import { ExerciseResult } from "../model/ExerciseResult";

const COLLECTION = "levelTestAttempts";

/**
 * Encapsulates all database access for the `levelTestAttempts` collection.
 * Each document is a full stateful Level Test attempt (F21).
 */
export class LevelTestAttemptStore {

    private db: Db;
    private config: ControllerConfig;

    constructor({ db, config }: { db: Db; config: ControllerConfig }) {

        this.db = db;
        this.config = config;
    }

    /**
     * Inserts a new LevelTestAttempt document and returns the MongoDB-generated _id as a string.
     *
     * @param {LevelTestAttempt} attempt - The attempt to persist.
     *
     * @returns {Promise<string>} The inserted document's _id as a hex string.
     */
    async create(attempt: LevelTestAttempt): Promise<string> {

        const result = await this.db.collection(COLLECTION).insertOne(attempt.toBSON());

        return result.insertedId.toString();
    }

    /**
     * Finds a single attempt by its MongoDB _id. Returns null if no document matches.
     *
     * @param {string} attemptId - The hex-string _id to look up.
     *
     * @returns {Promise<LevelTestAttempt | null>} The found attempt, or null.
     */
    async findById(attemptId: string): Promise<LevelTestAttempt | null> {

        const doc = await this.db.collection(COLLECTION).findOne({ _id: new ObjectId(attemptId) });

        if (!doc) return null;

        return LevelTestAttempt.fromBSON(doc as any);
    }

    /**
     * Returns the single in-progress (un-submitted) attempt for a user + level pair.
     * An attempt is in-progress when its `takenAt` field is null.
     *
     * @param {string} userId - The user id.
     * @param {string} cefrLevel - The CEFR level.
     *
     * @returns {Promise<LevelTestAttempt | null>} The active attempt, or null.
     */
    async findActiveByUserAndLevel(userId: string, cefrLevel: string): Promise<LevelTestAttempt | null> {

        const doc = await this.db.collection(COLLECTION).findOne({ userId, cefrLevel, takenAt: null });

        if (!doc) return null;

        return LevelTestAttempt.fromBSON(doc as any);
    }

    /**
     * Returns the most recently submitted attempt for a user + level pair, used to
     * enforce the inter-attempt cooldown (F21). Submitted attempts have a non-null `takenAt`.
     *
     * @param {string} userId - The user id.
     * @param {string} cefrLevel - The CEFR level.
     *
     * @returns {Promise<LevelTestAttempt | null>} The most recent submitted attempt, or null.
     */
    async findMostRecentSubmittedByUserAndLevel(userId: string, cefrLevel: string): Promise<LevelTestAttempt | null> {

        const docs = await this.db.collection(COLLECTION).find({ userId, cefrLevel, takenAt: { $ne: null } }).sort({ takenAt: -1 }).limit(1).toArray();

        if (docs.length === 0) return null;

        return LevelTestAttempt.fromBSON(docs[0] as any);
    }

    /**
     * Appends a TestAnswer to the attempt's answers array.
     * The first answer to each exercise is final for grading — there is no retry mechanism.
     *
     * @param {string} attemptId - The attempt _id.
     * @param {TestAnswer} answer - The answer to append.
     */
    async appendAnswer(attemptId: string, answer: TestAnswer): Promise<void> {

        await this.db.collection(COLLECTION).updateOne(
            { _id: new ObjectId(attemptId) },
            { $push: { answers: answer } } as any
        );
    }

    /**
     * Increments `currentPosition` by 1, advancing the cursor to the next exercise.
     *
     * @param {string} attemptId - The attempt _id.
     */
    async advancePosition(attemptId: string): Promise<void> {

        await this.db.collection(COLLECTION).updateOne(
            { _id: new ObjectId(attemptId) },
            { $inc: { currentPosition: 1 } }
        );
    }

    /**
     * Appends an exercise id to `verifiedExerciseIds`.
     * Used by the F13 answer verification flow to enforce the one-per-attempt guard.
     *
     * @param {string} attemptId - The attempt _id.
     * @param {string} exerciseId - The exercise id to mark as AI-verified.
     */
    async addVerifiedExerciseId(attemptId: string, exerciseId: string): Promise<void> {

        await this.db.collection(COLLECTION).updateOne(
            { _id: new ObjectId(attemptId) },
            { $push: { verifiedExerciseIds: exerciseId } } as any
        );
    }

    /**
     * Flips the stored `isCorrect` flag to true for the given exercise in the answers array.
     * Called by the F13 answer verification flow when the AI validates a translation.
     *
     * @param {string} attemptId - The attempt _id.
     * @param {string} exerciseId - The exercise id whose answer should be flipped to correct.
     */
    async flipAnswerToCorrect(attemptId: string, exerciseId: string): Promise<void> {

        await this.db.collection(COLLECTION).updateOne(
            { _id: new ObjectId(attemptId), "answers.exerciseId": exerciseId },
            { $set: { "answers.$.isCorrect": true } } as any
        );
    }

    /**
     * Finalises a Level Test attempt by persisting the computed score, pass/fail verdict,
     * submission timestamp, and per-exercise mastery results. Sets `takenAt` to mark the
     * attempt as submitted — after this call `findActiveByUserAndLevel` no longer returns it.
     *
     * @param {string} attemptId - The attempt _id.
     * @param {SubmitParams} params - The grading outcome to persist.
     */
    async submit(attemptId: string, { score, passed, takenAt, exerciseResults }: SubmitParams): Promise<void> {

        await this.db.collection(COLLECTION).updateOne(
            { _id: new ObjectId(attemptId) },
            {
                $set: {
                    score,
                    passed,
                    takenAt,
                    exerciseResults: exerciseResults.map(r => r.toBSON()),
                },
            } as any
        );
    }
}

interface SubmitParams {
    score: number;                      // Percentage correct (0–100)
    passed: boolean;                    // Whether score >= LEVEL_TEST_PASS_THRESHOLD
    takenAt: string;                    // ISO-8601 submission timestamp
    exerciseResults: ExerciseResult[];  // Per-exercise mastery results for F06
}
