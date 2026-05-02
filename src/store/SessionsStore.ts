import { Db, ObjectId } from "mongodb";
import { ControllerConfig } from "../Config";
import { Session, SessionAnswer } from "../model/Session";

const SESSIONS_COLLECTION = "sessions";

export class SessionsStore {

    private db: Db;
    private config: ControllerConfig;

    constructor({ db, config }: { db: Db; config: ControllerConfig }) {
        this.db = db;
        this.config = config;
    }

    async findActiveSession({ userId }: { userId: string }): Promise<Session | null> {
        const result = await this.db.collection(SESSIONS_COLLECTION).findOne({ userId, status: "active" });
        if (!result) return null;
        return Session.fromBSON(result);
    }

    async findSessionById({ sessionId }: { sessionId: string }): Promise<Session | null> {
        const result = await this.db.collection(SESSIONS_COLLECTION).findOne({ _id: new ObjectId(sessionId) });
        if (!result) return null;
        return Session.fromBSON(result);
    }

    async createSession({ session }: { session: Session }): Promise<string> {
        const result = await this.db.collection(SESSIONS_COLLECTION).insertOne(session.toBSON());
        return result.insertedId.toString();
    }

    /**
     * Atomically appends an answer to session.payload.answers using $push to
     * avoid race conditions under concurrent submissions.
     */
    async appendAnswer({ sessionId, answer }: { sessionId: string; answer: SessionAnswer }): Promise<void> {
        await this.db.collection(SESSIONS_COLLECTION).updateOne(
            { _id: new ObjectId(sessionId) },
            { $push: { "payload.answers": answer } } as any
        );
    }

    async completeSession({ sessionId }: { sessionId: string }): Promise<void> {
        await this.db.collection(SESSIONS_COLLECTION).updateOne(
            { _id: new ObjectId(sessionId) },
            { $set: { status: "completed", completedAt: new Date().toISOString() } }
        );
    }

    /**
     * Aggregates completed sessions per day within [from, to] (UTC).
     * Returns only days that have at least one session; zero-filling is the caller's responsibility.
     */
    async countCompletedByDateRange({ userId, from, to }: {
        userId: string;
        from: Date;
        to: Date;
    }): Promise<Array<{ date: string; count: number }>> {
        const results = await this.db.collection(SESSIONS_COLLECTION).aggregate([
            {
                $match: {
                    userId,
                    status: "completed",
                    completedAt: { $gte: from.toISOString(), $lte: to.toISOString() },
                }
            },
            {
                $addFields: {
                    dateStr: {
                        $dateToString: {
                            format: "%Y%m%d",
                            timezone: "UTC",
                            date: {
                                $dateFromString: {
                                    dateString: "$completedAt",
                                    onError: null,
                                    onNull: null,
                                }
                            }
                        }
                    }
                }
            },
            { $match: { dateStr: { $ne: null } } },
            { $group: { _id: "$dateStr", count: { $sum: 1 } } },
        ]).toArray();

        return results.map(r => ({ date: r._id as string, count: r.count as number }));
    }
}
