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
}
