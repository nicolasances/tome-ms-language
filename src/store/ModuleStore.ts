import { Db } from "mongodb";
import { Module } from "../model/Module";

const MODULES_COLLECTION = "modules";

export interface InsertOneResult {
    status: "created" | "duplicate_id";
    module: Module;
}

export class ModuleStore {

    private db: Db;

    constructor(db: Db) {
        this.db = db;
    }

    /**
     * Inserts a new module into the collection.
     * Rejects with duplicate_id if a module with the same id already exists.
     */
    async insertOne(module: Module): Promise<InsertOneResult> {

        const collection = this.db.collection(MODULES_COLLECTION);

        const byId = await collection.findOne({ id: module.id });

        if (byId) {
            return { status: "duplicate_id", module: Module.fromBSON(byId as any) };
        }

        await collection.insertOne(module.toBSON());

        return { status: "created", module };
    }

    /**
     * Finds a module by its caller-provided id.
     * Returns null if not found.
     */
    async findById(id: string): Promise<Module | null> {

        const doc = await this.db.collection(MODULES_COLLECTION).findOne({ id });

        if (!doc) return null;

        return Module.fromBSON(doc as any);
    }

    /**
     * Lists modules, optionally filtered by cefrLevel and/or isUserGenerated.
     * Results are sorted by id ascending to preserve curriculum ordering.
     */
    async list(cefrLevel?: string, isUserGenerated?: boolean): Promise<Module[]> {

        const filter: Record<string, any> = {};

        if (cefrLevel) filter.cefrLevel = cefrLevel;
        if (isUserGenerated !== undefined) filter.isUserGenerated = isUserGenerated;

        const docs = await this.db.collection(MODULES_COLLECTION).find(filter).sort({ id: 1 }).toArray();

        return docs.map(doc => Module.fromBSON(doc as any));
    }
}
