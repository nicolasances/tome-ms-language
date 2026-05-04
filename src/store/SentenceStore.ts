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

    async insertSentence(sentence: Sentence): Promise<string> {
        const result = await this.db
            .collection(SENTENCES_COLLECTION)
            .insertOne(sentence.toBSON());
        return result.insertedId.toHexString();
    }

    /**
     * Insert multiple sentences. Returns an array of per-item results in the
     * same order as the input array. Each result is either { status: "created", id }
     * or { status: "error", reason }.
     */
    async insertSentences(sentences: Sentence[]): Promise<Array<{ status: "created"; id: string } | { status: "error"; reason: string }>> {
        const results: Array<{ status: "created"; id: string } | { status: "error"; reason: string }> = [];

        for (const sentence of sentences) {
            try {
                const id = await this.insertSentence(sentence);
                results.push({ status: "created", id });
            } catch (err: any) {
                results.push({ status: "error", reason: "insert_failed" });
            }
        }

        return results;
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
}
