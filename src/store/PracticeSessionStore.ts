import { Db, ObjectId } from "mongodb";
import * as moment from "moment-timezone";
import { ControllerConfig } from "../Config";
import { PracticeAnswer, PracticeSession } from "../model/PracticeSession";

const COLLECTION = "practiceSessions";

export class PracticeSessionStore {

    private db: Db;
    private config: ControllerConfig;

    constructor({ db, config }: { db: Db; config: ControllerConfig }) {
        this.db = db;
        this.config = config;
    }

    /**
     * Inserts a new PracticeSession and returns the MongoDB-generated _id as a string.
     */
    async create(session: PracticeSession): Promise<string> {

        const result = await this.db.collection(COLLECTION).insertOne(session.toBSON());

        return result.insertedId.toString();
    }

    /**
     * Finds a single practice session by its MongoDB _id.
     * Returns null if not found.
     */
    async findById(sessionId: string): Promise<PracticeSession | null> {

        const doc = await this.db.collection(COLLECTION).findOne({ _id: new ObjectId(sessionId) });

        if (!doc) return null;

        return PracticeSession.fromBSON(doc as any);
    }

    /**
     * Returns the active (not yet completed) practice session for a user+module pair.
     * A session is active when its completedAt field is null.
     * Returns null when no active session exists.
     */
    async findActiveByUserAndModule(userId: string, moduleId: string): Promise<PracticeSession | null> {

        const doc = await this.db.collection(COLLECTION).findOne({ userId, moduleId, completedAt: null });

        if (!doc) return null;

        return PracticeSession.fromBSON(doc as any);
    }

    /**
     * Appends an answer to the session's answers array.
     */
    async appendAnswer(sessionId: string, answer: PracticeAnswer): Promise<void> {

        await this.db.collection(COLLECTION).updateOne(
            { _id: new ObjectId(sessionId) },
            { $push: { answers: answer } } as any
        );
    }

    /**
     * Increments currentPosition by 1, moving the session forward to the next exercise.
     */
    async advancePosition(sessionId: string): Promise<void> {

        await this.db.collection(COLLECTION).updateOne(
            { _id: new ObjectId(sessionId) },
            { $inc: { currentPosition: 1 } }
        );
    }

    /**
     * Appends an exercise id to the session's retryQueue.
     * Called when the user answers an exercise incorrectly during the primary pass.
     */
    async addToRetryQueue(sessionId: string, exerciseId: string): Promise<void> {

        await this.db.collection(COLLECTION).updateOne(
            { _id: new ObjectId(sessionId) },
            { $push: { retryQueue: exerciseId } } as any
        );
    }

    /**
     * Marks the session complete by setting completedAt.
     */
    async complete(sessionId: string, completedAt: string): Promise<void> {

        await this.db.collection(COLLECTION).updateOne(
            { _id: new ObjectId(sessionId) },
            { $set: { completedAt } }
        );
    }

    /**
     * Appends an exercise id to the session's verifiedExerciseIds array.
     * Used by the F13 answer verification flow to enforce the one-per-attempt guard.
     *
     * @param {string} sessionId - The id of the practice session.
     * @param {string} exerciseId - The exercise id to mark as having used verification.
     */
    async addVerifiedExerciseId(sessionId: string, exerciseId: string): Promise<void> {

        await this.db.collection(COLLECTION).updateOne(
            { _id: new ObjectId(sessionId) },
            { $push: { verifiedExerciseIds: exerciseId } } as any
        );
    }

    /**
     * Removes an exercise id from the session's retryQueue.
     * Called by the F13 answer verification flow when the AI validates the user's translation —
     * removing the exercise from the retry queue prevents it from being shown again.
     *
     * @param {string} sessionId - The id of the practice session.
     * @param {string} exerciseId - The exercise id to remove from the retry queue.
     */
    async removeFromRetryQueue(sessionId: string, exerciseId: string): Promise<void> {

        await this.db.collection(COLLECTION).updateOne(
            { _id: new ObjectId(sessionId) },
            { $pull: { retryQueue: exerciseId } } as any
        );
    }

    /**
     * Returns a map of YYYYMMDD → completed-session count for the given user and date window.
     * Only sessions with a non-null completedAt that falls within [from, to] (inclusive, in
     * the given timezone) are counted. Days with no activity are absent from the map.
     *
     * @param {string} userId - The user whose sessions to count.
     * @param {string} from - First day of the window (YYYYMMDD).
     * @param {string} to - Last day of the window (YYYYMMDD).
     * @param {string} timezone - IANA timezone for civil-day bucketing.
     */
    async countCompletedByDay(userId: string, from: string, to: string, timezone: string): Promise<Map<string, number>> {

        const startIso = moment.tz(from, "YYYYMMDD", timezone).startOf("day").toISOString();
        const endIso = moment.tz(to, "YYYYMMDD", timezone).endOf("day").toISOString();

        const docs = await this.db.collection(COLLECTION).find({
            userId,
            completedAt: { $gte: startIso, $lte: endIso },
        }).toArray();

        const counts = new Map<string, number>();
        for (const doc of docs) {
            if (!doc.completedAt) continue;
            const day = moment.tz(doc.completedAt as string, timezone).format("YYYYMMDD");
            counts.set(day, (counts.get(day) ?? 0) + 1);
        }

        return counts;
    }
}
