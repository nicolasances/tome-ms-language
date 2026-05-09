import { Db } from "mongodb";
import { ControllerConfig } from "../Config";
import { SentenceStats } from "../model/SentenceStats";

const SENTENCE_STATS_COLLECTION = "sentence_stats";

export class SentenceStatsStore {

    private db: Db;
    private config: ControllerConfig;

    constructor({ db, config }: { db: Db; config: ControllerConfig }) {
        this.db = db;
        this.config = config;
    }

    async findByUserAndLanguage({ userId, language }: { userId: string; language: string }): Promise<SentenceStats[]> {
        const results = await this.db.collection(SENTENCE_STATS_COLLECTION).find({ userId, language }).toArray();
        return results.map(doc => SentenceStats.fromBSON(doc as any));
    }

    /**
     * Upserts sentence stats for a batch of sentences in a single bulkWrite.
     * Uses an aggregation pipeline update to atomically increment counters
     * and recompute failureRatio in one operation per sentence.
     */
    async upsertBatch({ statsList }: {
        statsList: Array<{
            userId: string;
            sentenceId: string;
            language: string;
            sessionAttempts: number;
            sessionFailures: number;
            lastPracticed: string;
        }>
    }): Promise<void> {
        if (statsList.length === 0) return;

        const operations = statsList.map(stat => ({
            updateOne: {
                filter: { userId: stat.userId, sentenceId: stat.sentenceId },
                update: [
                    {
                        $set: {
                            language: stat.language,
                            lastPracticed: stat.lastPracticed,
                            updatedAt: stat.lastPracticed,
                            totalAttempts: { $add: [{ $ifNull: ["$totalAttempts", 0] }, stat.sessionAttempts] },
                            totalFailures: { $add: [{ $ifNull: ["$totalFailures", 0] }, stat.sessionFailures] },
                        },
                    },
                    {
                        $set: {
                            failureRatio: {
                                $cond: {
                                    if: { $gt: ["$totalAttempts", 0] },
                                    then: { $divide: ["$totalFailures", "$totalAttempts"] },
                                    else: 0,
                                },
                            },
                        },
                    },
                ],
                upsert: true,
            },
        }));

        await this.db.collection(SENTENCE_STATS_COLLECTION).bulkWrite(operations as any);
    }
}
