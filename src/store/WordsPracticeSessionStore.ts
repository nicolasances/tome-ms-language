import { Db, ObjectId } from "mongodb";
import { ControllerConfig } from "../Config";
import { WordsPracticeSession } from "../model/WordsPracticeSession";

const COLLECTION = "wordsPracticeSessions";

export class WordsPracticeSessionStore {

    private db: Db;
    private config: ControllerConfig;

    constructor({ db, config }: { db: Db; config: ControllerConfig }) {
        this.db = db;
        this.config = config;
    }

    /**
     * Inserts a new Words Practice session.
     *
     * @param {WordsPracticeSession} session - The session to insert.
     *
     * @returns {Promise<string>} The MongoDB-generated _id as a string.
     */
    async create(session: WordsPracticeSession): Promise<string> {

        const result = await this.db.collection(COLLECTION).insertOne(session.toBSON());

        return result.insertedId.toString();
    }

    /**
     * Finds a session by its MongoDB _id.
     *
     * @param {string} sessionId - The session id (hex string).
     *
     * @returns {Promise<WordsPracticeSession | null>} The session, or null when not found.
     */
    async findById(sessionId: string): Promise<WordsPracticeSession | null> {

        const doc = await this.db.collection(COLLECTION).findOne({ _id: new ObjectId(sessionId) });

        if (!doc) return null;

        return WordsPracticeSession.fromBSON(doc as any);
    }

    /**
     * Finds the user's open (`in_progress`) session. There is at most one per user.
     *
     * @param {string} userId - The owner.
     *
     * @returns {Promise<WordsPracticeSession | null>} The open session, or null when there is none.
     */
    async findInProgressByUser(userId: string): Promise<WordsPracticeSession | null> {

        const doc = await this.db.collection(COLLECTION).findOne({ userId, status: "in_progress" });

        if (!doc) return null;

        return WordsPracticeSession.fromBSON(doc as any);
    }

    /**
     * Replaces the stored session with the given state (words, attempts, status, completedAt,
     * lastAnsweredWordKey). The session must already have an id.
     *
     * @param {WordsPracticeSession} session - The session to persist.
     */
    async save(session: WordsPracticeSession): Promise<void> {

        await this.db.collection(COLLECTION).replaceOne({ _id: new ObjectId(session.id!) }, session.toBSON());
    }
}
