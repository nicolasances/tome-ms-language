import { Db, ObjectId } from "mongodb";
import { randomUUID } from "crypto";
import { ControllerConfig } from "../Config";
import { Sentence } from "../model/Sentence";
import { buildDifficultySortStage } from "../util/SortUtils";

const SENTENCES_COLLECTION = "sentences";
const SENTENCE_STATS_COLLECTION = "sentence_stats";

export interface SentenceWithStats {
    id: string;
    sentence: string;
    translation: string;
    createdAt: string;
    knowledgeSource: string;
    alternativeTranslations: Array<{ id: string; translation: string }>;
    stats: {
        failureRatio: number;
        totalAttempts: number;
        totalFailures: number;
        lastPracticed: string;
    } | null;
}

export interface SentencesWithStatsResult {
    sentences: SentenceWithStats[];
    totalCount: number;
}

export class SentenceStore {

    private db: Db;
    private config: ControllerConfig;

    constructor(db: Db, config: ControllerConfig) {
        this.db = db;
        this.config = config;
    }

    async findByLanguage(language: string): Promise<Sentence[]> {
        const results = await this.db
            .collection(SENTENCES_COLLECTION)
            .find({ language })
            .sort({ createdAt: -1 })
            .toArray();
        return results.map(doc => Sentence.fromBSON(doc as any));
    }

    /**
     * Upsert a single sentence. The unique key is (language, sentence).
     * Returns the id of the existing or newly-created document.
     */
    async insertSentence(sentence: Sentence): Promise<string> {
        const [id] = await this.insertSentences([sentence]);
        return id;
    }

    /**
     * Upsert multiple sentences. The unique key is (language, sentence).
     * Returns an array of per-item results in the same order as the input.
     * Each result is { status: "created", id } — "created" covers both new inserts
     * and updates to existing documents so callers do not need to change.
     */
    async insertSentences(sentences: Sentence[]): Promise<string[]> {
        if (sentences.length === 0) return [];

        const collection = this.db.collection(SENTENCES_COLLECTION);
        const idsByKey = await this.getIdsBySentenceKey(sentences);

        const operations = sentences.map(s => ({
            updateOne: {
                filter: this.getSentenceFilter(s),
                update: { $set: s.toBSON() },
                upsert: true,
            },
        }));

        const result = await collection.bulkWrite(operations, { ordered: false });

        for (const [indexText, upsertedId] of Object.entries(result.upsertedIds)) {
            const index = Number(indexText);
            const key = this.getSentenceKey(sentences[index]);
            idsByKey.set(key, upsertedId.toHexString());
        }

        const resolvedIds: string[] = [];

        for (const sentence of sentences) {
            const key = this.getSentenceKey(sentence);
            const existingId = idsByKey.get(key);
            if (existingId) {
                resolvedIds.push(existingId);
                continue;
            }

            const found = await collection.findOne(this.getSentenceFilter(sentence));
            if (!found?._id) {
                throw new Error(`Failed to resolve id for sentence: ${sentence.language}/${sentence.sentence}`);
            }

            resolvedIds.push(found._id.toString());
            idsByKey.set(key, found._id.toString());
        }

        return resolvedIds;
    }

    async findById(id: string): Promise<Sentence | null> {
        let oid: ObjectId;
        try { oid = new ObjectId(id); } catch { return null; }
        const doc = await this.db.collection(SENTENCES_COLLECTION).findOne({ _id: oid });
        if (!doc) return null;
        return Sentence.fromBSON(doc as any);
    }

    async addAlternative(sentenceId: string, translation: string): Promise<{ id: string; translation: string } | null> {
        
        let oid = new ObjectId(sentenceId);
        
        const normalised = translation.toLowerCase();
        
        const existing = await this.db.collection(SENTENCES_COLLECTION).findOne({ _id: oid, "alternativeTranslations.translation": normalised });
        
        if (existing) {
            const alt = (existing.alternativeTranslations as Array<{ id: string; translation: string }>).find(a => a.translation === normalised);
            return alt ?? null;
        }
        
        const newAlt = { id: randomUUID(), translation: normalised };
        
        const result = await this.db.collection(SENTENCES_COLLECTION).updateOne({ _id: oid }, { $push: { alternativeTranslations: newAlt } as any });
        
        if (result.matchedCount === 0) return null;
        
        return newAlt;
    }

    async removeAlternative(sentenceId: string, altId: string): Promise<boolean> {
        
        const result = await this.db.collection(SENTENCES_COLLECTION).updateOne({ _id: new ObjectId(sentenceId) }, { $pull: { alternativeTranslations: { id: altId } } as any });
        
        return result.matchedCount > 0;
    }

    /**
     * Return a random sample of `n` vocabulary words for the given language using
     * MongoDB's $sample aggregation stage.
     */
    async sampleWords(language: string, n: number): Promise<any[]> {
        return this.db
            .collection("vocabulary")
            .aggregate([
                { $match: { language } },
                { $sample: { size: n } },
            ])
            .toArray();
    }

    private async getIdsBySentenceKey(sentences: Sentence[]): Promise<Map<string, string>> {
        const uniqueFilters = new Map<string, { language: string; sentence: string }>();

        for (const s of sentences) {
            uniqueFilters.set(this.getSentenceKey(s), this.getSentenceFilter(s));
        }

        if (uniqueFilters.size === 0) return new Map();

        const existing = await this.db
            .collection(SENTENCES_COLLECTION)
            .find({ $or: Array.from(uniqueFilters.values()) })
            .toArray();

        const idsByKey = new Map<string, string>();
        for (const doc of existing) {
            const key = this.getSentenceKey({ language: doc.language, sentence: doc.sentence });
            idsByKey.set(key, doc._id.toString());
        }

        return idsByKey;
    }

    private getSentenceFilter(s: Pick<Sentence, "language" | "sentence">): { language: string; sentence: string } {
        return { language: s.language, sentence: s.sentence };
    }

    private getSentenceKey(s: Pick<Sentence, "language" | "sentence">): string {
        return `${s.language}::${s.sentence}`;
    }

    /**
     * Finds sentences by language with user-specific stats using a LEFT OUTER JOIN.
     *
     * Default sort: alphabetical by `sentence`.
     * When sortBy=difficulty: sort by failureRatio (sortDir controls direction).
     * Items without stats always appear at the end when sorting by difficulty.
     */
    async findByLanguageWithStats({ language, userId, page, pageSize, sortBy, sortDir }: {
        language: string;
        userId: string;
        page: number;
        pageSize: number;
        sortBy?: "difficulty";
        sortDir?: "asc" | "desc";
    }): Promise<SentencesWithStatsResult> {

        const skip = (page - 1) * pageSize;

        const totalCount = await this.db.collection(SENTENCES_COLLECTION).countDocuments({ language });

        const sortStage = sortBy === "difficulty"
            ? this.buildDifficultySortStage(sortDir ?? "asc")
            : [{ $sort: { sentence: 1 as const } }];

        const pipeline = [
            { $match: { language } },
            {
                $addFields: {
                    sentenceIdStr: { $toString: "$_id" }
                }
            },
            {
                $lookup: {
                    from: SENTENCE_STATS_COLLECTION,
                    let: { sentenceId: "$sentenceIdStr" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$sentenceId", "$$sentenceId"] },
                                        { $eq: ["$userId", userId] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: "statsArray"
                }
            },
            {
                $addFields: {
                    stats: { $arrayElemAt: ["$statsArray", 0] }
                }
            },
            ...sortStage,
            { $skip: skip },
            { $limit: pageSize },
            {
                $project: {
                    _id: 1,
                    sentence: 1,
                    translation: 1,
                    createdAt: 1,
                    knowledgeSource: 1,
                    alternativeTranslations: { $ifNull: ["$alternativeTranslations", []] },
                    stats: {
                        $cond: {
                            if: { $ifNull: ["$stats", false] },
                            then: {
                                failureRatio: "$stats.failureRatio",
                                totalAttempts: "$stats.totalAttempts",
                                totalFailures: "$stats.totalFailures",
                                lastPracticed: "$stats.lastPracticed"
                            },
                            else: null
                        }
                    }
                }
            }
        ];

        const results = await this.db.collection(SENTENCES_COLLECTION).aggregate(pipeline).toArray();

        const sentences: SentenceWithStats[] = results.map(doc => ({
            id: doc._id.toString(),
            sentence: doc.sentence,
            translation: doc.translation,
            createdAt: doc.createdAt,
            knowledgeSource: doc.knowledgeSource,
            alternativeTranslations: doc.alternativeTranslations ?? [],
            stats: doc.stats
        }));

        return { sentences, totalCount };
    }

    /**
     * Builds the aggregation sort stage for difficulty sorting.
     * Items without stats always sort to the end regardless of direction.
     */
    private buildDifficultySortStage(sortDir: "asc" | "desc"): object[] {
        return buildDifficultySortStage(sortDir);
    }
}
