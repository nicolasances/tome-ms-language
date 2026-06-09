import { Db, ObjectId } from "mongodb";
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
}
