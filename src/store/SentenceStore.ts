import { Db, ObjectId } from "mongodb";
import { ControllerConfig } from "../Config";
import { Sentence } from "../model/Sentence";

const SENTENCES_COLLECTION = "sentences";

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
}
