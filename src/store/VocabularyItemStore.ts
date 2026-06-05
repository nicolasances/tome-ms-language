import { Db } from "mongodb";
import { VocabularyItem } from "../model/VocabularyItem";

const VOCABULARY_COLLECTION = "vocabulary";

export interface InsertOneResult {
    status: "created" | "duplicate_id" | "duplicate_canonical"; // duplicate_canonical is deprecated - will have to be removed
    item: VocabularyItem;
}

export interface BatchItemResult {
    id: string;
    status: "created" | "duplicate_id" | "duplicate_canonical"; // duplicate_canonical is deprecated - will have to be removed
}

export interface InsertBatchResult {
    inserted: number;
    alreadyPresent: number;
    items: BatchItemResult[];
}

export class VocabularyItemStore {

    private db: Db;

    constructor(db: Db) {
        this.db = db;
    }

    async insertOne(item: VocabularyItem): Promise<InsertOneResult> {

        const collection = this.db.collection(VOCABULARY_COLLECTION);

        const byId = await collection.findOne({ id: item.id });

        if (byId) {
            return { status: "duplicate_id", item: VocabularyItem.fromBSON(byId as any) };
        }

        await collection.insertOne(item.toBSON());

        return { status: "created", item };
    }

    async insertBatch(items: VocabularyItem[]): Promise<InsertBatchResult> {

        if (items.length === 0) {
            return { inserted: 0, alreadyPresent: 0, items: [] };
        }

        const collection = this.db.collection(VOCABULARY_COLLECTION);

        const inputIds = items.map(i => i.id);
        const existingById = await collection.find({ id: { $in: inputIds } }).toArray();
        const existingIdSet = new Set(existingById.map(doc => doc.id as string));

        const batchResults: BatchItemResult[] = [];
        const toInsert: VocabularyItem[] = [];

        for (const item of items) {
            if (existingIdSet.has(item.id)) {
                batchResults.push({ id: item.id, status: "duplicate_id" });
                continue;
            }

            toInsert.push(item);
            batchResults.push({ id: item.id, status: "created" });
        }

        if (toInsert.length > 0) {
            await collection.insertMany(toInsert.map(i => i.toBSON()), { ordered: false });
        }

        const alreadyPresent = batchResults.filter(r => r.status !== "created").length;

        return { inserted: toInsert.length, alreadyPresent, items: batchResults };
    }

    async findById(id: string): Promise<VocabularyItem | null> {

        const doc = await this.db.collection(VOCABULARY_COLLECTION).findOne({ id });

        if (!doc) return null;

        return VocabularyItem.fromBSON(doc as any);
    }

    async findByIds(ids: string[]): Promise<VocabularyItem[]> {

        const docs = await this.db.collection(VOCABULARY_COLLECTION).find({ id: { $in: ids } }).toArray();

        return docs.map(doc => VocabularyItem.fromBSON(doc as any));
    }

    async list(cefrLevel?: string): Promise<VocabularyItem[]> {

        const filter = cefrLevel ? { cefrLevel } : {};
        const docs = await this.db.collection(VOCABULARY_COLLECTION).find(filter).sort({ danish: 1 }).toArray();

        return docs.map(doc => VocabularyItem.fromBSON(doc as any));
    }
}
