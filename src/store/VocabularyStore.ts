import { Db, ObjectId } from "mongodb";
import { ControllerConfig } from "../Config";
import { Word } from "../model/Word";

const VOCABULARY_COLLECTION = "vocabulary";

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

    async updateWord(id: string, fields: { english?: string; translation?: string }): Promise<boolean> {

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
}
