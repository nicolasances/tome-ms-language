import { Db } from "mongodb";
import { GrammarConcept } from "../model/GrammarConcept";

const GRAMMAR_COLLECTION = "grammar";

export interface InsertOneResult {
    status: "created" | "duplicate_id";
    concept: GrammarConcept;
}

export interface BatchItemResult {
    id: string;
    status: "created" | "duplicate_id";
}

export interface InsertBatchResult {
    inserted: number;
    alreadyPresent: number;
    items: BatchItemResult[];
}

export class GrammarConceptStore {

    private db: Db;

    constructor(db: Db) {
        this.db = db;
    }

    async insertOne(concept: GrammarConcept): Promise<InsertOneResult> {

        const collection = this.db.collection(GRAMMAR_COLLECTION);

        const byId = await collection.findOne({ id: concept.id });

        if (byId) {

            return { status: "duplicate_id", concept: GrammarConcept.fromBSON(byId as any) };
        }

        await collection.insertOne(concept.toBSON());

        return { status: "created", concept };
    }

    async findById(id: string): Promise<GrammarConcept | null> {

        const doc = await this.db.collection(GRAMMAR_COLLECTION).findOne({ id });

        if (!doc) return null;

        return GrammarConcept.fromBSON(doc as any);
    }

    async insertBatch(concepts: GrammarConcept[]): Promise<InsertBatchResult> {

        if (concepts.length === 0) {

            return { inserted: 0, alreadyPresent: 0, items: [] };
        }

        const collection = this.db.collection(GRAMMAR_COLLECTION);

        const inputIds = concepts.map(c => c.id);
        const existingById = await collection.find({ id: { $in: inputIds } }).toArray();
        const existingIdSet = new Set(existingById.map(doc => doc.id as string));

        const batchResults: BatchItemResult[] = [];
        const toInsert: GrammarConcept[] = [];

        for (const concept of concepts) {

            if (existingIdSet.has(concept.id)) {
                batchResults.push({ id: concept.id, status: "duplicate_id" });
                continue;
            }

            toInsert.push(concept);
            batchResults.push({ id: concept.id, status: "created" });
        }

        if (toInsert.length > 0) {

            await collection.insertMany(toInsert.map(c => c.toBSON()), { ordered: false });
        }

        const alreadyPresent = batchResults.filter(r => r.status !== "created").length;

        return { inserted: toInsert.length, alreadyPresent, items: batchResults };
    }
}
