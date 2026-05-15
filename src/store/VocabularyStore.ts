import { Db, ObjectId } from "mongodb";
import { ControllerConfig } from "../Config";
import { Word } from "../model/Word";
import { buildDifficultySortStage } from "../util/SortUtils";

const VOCABULARY_COLLECTION = "vocabulary";
const WORD_STATS_COLLECTION = "word_stats";

export interface WordWithStats {
    id: string;
    english: string;
    translation: string;
    createdAt: string;
    knowledgeSource: string;
    stats: {
        failureRatio: number;
        totalAttempts: number;
        totalFailures: number;
        lastPracticed: string;
    } | null;
}

export interface VocabularyWithStatsResult {
    words: WordWithStats[];
    totalCount: number;
}

export class VocabularyStore {

    private db: Db;
    private config: ControllerConfig;

    constructor(db: Db, config: ControllerConfig) {
        this.db = db;
        this.config = config;
    }

    async findByLanguage(language: string): Promise<Word[]> {
        const results = await this.db.collection(VOCABULARY_COLLECTION).find({ language }).toArray();
        return results.map(doc => Word.fromBSON(doc as any));
    }

    async insertWord(word: Word): Promise<string> {

        const [id] = await this.insertWords([word]);
        return id;
    }

    async insertWords(words: Word[]): Promise<string[]> {

        if (words.length === 0) return [];

        const collection = this.db.collection(VOCABULARY_COLLECTION);
        const idsByKey = await this.getIdsByWordKey(words);
        const operations = words.map(word => ({
            updateOne: {
                filter: this.getWordFilter(word),
                update: { $set: word.toBSON() },
                upsert: true,
            },
        }));
        const result = await collection.bulkWrite(operations, { ordered: false });

        for (const [indexText, upsertedId] of Object.entries(result.upsertedIds)) {
            const index = Number(indexText);
            const key = this.getWordKey(words[index]);
            idsByKey.set(key, upsertedId.toHexString());
        }

        const resolvedIds: string[] = [];

        for (const word of words) {
            const key = this.getWordKey(word);
            const existingId = idsByKey.get(key);
            if (existingId) {
                resolvedIds.push(existingId);
                continue;
            }

            const foundWord = await collection.findOne(this.getWordFilter(word));
            if (!foundWord?._id) {
                throw new Error(`Failed to resolve id for word: ${word.language}/${word.english}/${word.translation}`);
            }

            resolvedIds.push(foundWord._id.toString());
            idsByKey.set(key, foundWord._id.toString());
        }

        return resolvedIds;
    }

    private async getIdsByWordKey(words: Word[]): Promise<Map<string, string>> {

        const uniqueFilters = new Map<string, { language: string; english: string; translation: string }>();

        for (const word of words) {
            uniqueFilters.set(this.getWordKey(word), this.getWordFilter(word));
        }

        if (uniqueFilters.size === 0) return new Map();

        const existingWords = await this.db
            .collection(VOCABULARY_COLLECTION)
            .find({ $or: Array.from(uniqueFilters.values()) })
            .toArray();

        const idsByKey = new Map<string, string>();

        for (const item of existingWords) {
            const key = this.getWordKey({
                language: item.language,
                english: item.english,
                translation: item.translation,
            });
            idsByKey.set(key, item._id.toString());
        }

        return idsByKey;
    }

    private getWordFilter(word: Pick<Word, "language" | "english" | "translation">): { language: string; english: string; translation: string } {

        return {
            language: word.language,
            english: word.english,
            translation: word.translation,
        };
    }

    private getWordKey(word: Pick<Word, "language" | "english" | "translation">): string {

        return `${word.language}::${word.english}::${word.translation}`;
    }

    async updateWord(id: string, fields: { english?: string; translation?: string; knowledgeSource?: string }): Promise<boolean> {

        const result = await this.db.collection(VOCABULARY_COLLECTION).updateOne(
            { _id: new ObjectId(id) },
            { $set: fields }
        );
        return result.matchedCount > 0;
    }

    async deleteWord(id: string): Promise<boolean> {

        const result = await this.db.collection(VOCABULARY_COLLECTION).deleteOne({ _id: new ObjectId(id) });
        
        return result.deletedCount > 0;
    }

    async findByLanguageWithStats({ language, userId, page, pageSize, sortBy, sortDir }: {
        language: string;
        userId: string;
        page: number;
        pageSize: number;
        sortBy?: "difficulty";
        sortDir?: "asc" | "desc";
    }): Promise<VocabularyWithStatsResult> {

        const skip = (page - 1) * pageSize;

        const totalCount = await this.db.collection(VOCABULARY_COLLECTION).countDocuments({ language });

        const sortStage = sortBy === "difficulty"
            ? this.buildDifficultySortStage(sortDir ?? "asc")
            : [{ $sort: { translation: 1 as const } }];

        const pipeline = [
            { $match: { language } },
            {
                $addFields: {
                    wordIdStr: { $toString: "$_id" }
                }
            },
            {
                $lookup: {
                    from: WORD_STATS_COLLECTION,
                    let: { wordId: "$wordIdStr" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$wordId", "$$wordId"] },
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
                    english: 1,
                    translation: 1,
                    createdAt: 1,
                    knowledgeSource: 1,
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

        const results = await this.db.collection(VOCABULARY_COLLECTION).aggregate(pipeline).toArray();

        const words: WordWithStats[] = results.map(doc => ({
            id: doc._id.toString(),
            english: doc.english,
            translation: doc.translation,
            createdAt: doc.createdAt,
            knowledgeSource: doc.knowledgeSource,
            stats: doc.stats
        }));

        return { words, totalCount };
    }

    /**
     * Builds the aggregation sort stage for difficulty sorting.
     * Items without stats always sort to the end regardless of direction.
     *
     * For desc: negate failureRatio so higher ratios sort first when sorting asc on sortKey.
     *   Items without stats get sortKey=1, which is > any value in [-1,0].
     * For asc: use failureRatio directly. Items without stats get sortKey=Number.MAX_VALUE.
     */
    private buildDifficultySortStage(sortDir: "asc" | "desc"): object[] {
        return buildDifficultySortStage(sortDir);
    }
}
