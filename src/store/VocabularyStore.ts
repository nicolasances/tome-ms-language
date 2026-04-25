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
        const result = await this.db.collection(VOCABULARY_COLLECTION).insertOne(word.toBSON());
        return result.insertedId.toString();
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
