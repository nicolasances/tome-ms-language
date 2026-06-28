import { Db, ObjectId } from "mongodb";
import * as moment from "moment-timezone";
import { ControllerConfig } from "../Config";
import { ModuleTestAttempt, TestAnswer } from "../model/ModuleTestAttempt";
import { ExerciseResult } from "../model/ExerciseResult";

const COLLECTION = "moduleTestAttempts";

/**
 * Encapsulates all database access for the `moduleTestAttempts` collection.
 * Each document is a full stateful Module Test attempt (F11).
 */
export class ModuleTestAttemptStore {

    private db: Db;
    private config: ControllerConfig;

    constructor({ db, config }: { db: Db; config: ControllerConfig }) {

        this.db = db;
        this.config = config;
    }

    /**
     * Inserts a new ModuleTestAttempt document and returns the MongoDB-generated _id as a string.
     *
     * @param {ModuleTestAttempt} attempt - The attempt to persist.
     *
     * @returns {Promise<string>} The inserted document's _id as a hex string.
     */
    async create(attempt: ModuleTestAttempt): Promise<string> {

        const result = await this.db.collection(COLLECTION).insertOne(attempt.toBSON());

        return result.insertedId.toString();
    }

    /**
     * Finds a single attempt by its MongoDB _id.
     * Returns null if no document matches.
     *
     * @param {string} attemptId - The hex-string _id to look up.
     *
     * @returns {Promise<ModuleTestAttempt | null>} The found attempt, or null.
     */
    async findById(attemptId: string): Promise<ModuleTestAttempt | null> {

        const doc = await this.db.collection(COLLECTION).findOne({ _id: new ObjectId(attemptId) });

        if (!doc) return null;

        return ModuleTestAttempt.fromBSON(doc as any);
    }

    /**
     * Returns the single in-progress (un-submitted) attempt for a user + module pair.
     * An attempt is in-progress when its `takenAt` field is null.
     * Returns null when no active attempt exists.
     *
     * @param {string} userId - The user id.
     * @param {string} moduleId - The module id.
     *
     * @returns {Promise<ModuleTestAttempt | null>} The active attempt, or null.
     */
    async findActiveByUserAndModule(userId: string, moduleId: string): Promise<ModuleTestAttempt | null> {

        const doc = await this.db.collection(COLLECTION).findOne({ userId, moduleId, takenAt: null });

        if (!doc) return null;

        return ModuleTestAttempt.fromBSON(doc as any);
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
     * This must happen before submit so the score naturally reflects it.
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
     * Finalises a Module Test attempt by persisting the computed score, pass/fail verdict,
     * submission timestamp, and per-exercise mastery results.
     * Sets `takenAt` to mark the attempt as submitted — after this call `findActiveByUserAndModule`
     * will no longer return this attempt.
     *
     * @param {string} attemptId - The attempt _id.
     * @param {{ score, passed, takenAt, exerciseResults }} params - The grading outcome to persist.
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

    /**
     * Returns a map of YYYYMMDD → passed-attempt count for the given user and date window.
     * Only attempts with `passed = true` and a non-null `takenAt` that falls within [from, to]
     * (inclusive, in the given timezone) are counted. Days with no qualifying attempts are absent.
     *
     * @param {string} userId - The user whose attempts to count.
     * @param {string} from - First day of the window (YYYYMMDD).
     * @param {string} to - Last day of the window (YYYYMMDD).
     * @param {string} timezone - IANA timezone for civil-day bucketing.
     */
    async countPassedByDay(userId: string, from: string, to: string, timezone: string): Promise<Map<string, number>> {

        const startIso = moment.tz(from, "YYYYMMDD", timezone).startOf("day").toISOString();
        const endIso = moment.tz(to, "YYYYMMDD", timezone).endOf("day").toISOString();

        const docs = await this.db.collection(COLLECTION).find({
            userId,
            passed: true,
            takenAt: { $gte: startIso, $lte: endIso },
        }).toArray();

        const counts = new Map<string, number>();
        for (const doc of docs) {
            if (!doc.takenAt) continue;
            const day = moment.tz(doc.takenAt as string, timezone).format("YYYYMMDD");
            counts.set(day, (counts.get(day) ?? 0) + 1);
        }

        return counts;
    }
}

interface SubmitParams {
    score: number;                  // Percentage correct (0–100)
    passed: boolean;                // Whether score >= testPassThreshold
    takenAt: string;                // ISO-8601 submission timestamp
    exerciseResults: ExerciseResult[]; // Per-exercise mastery results for F06
}
