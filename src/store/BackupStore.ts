import { Db, FindCursor, ObjectId } from "mongodb";

/** Number of documents inserted per `insertMany` batch when restoring a collection. */
const RESTORE_BATCH_SIZE = 200;

/**
 * Generic Mongo access backing `POST /backup` (#100) and `POST /restore` (#102). Unlike the other
 * Store classes, which are scoped to a single domain collection, this one is deliberately
 * collection-agnostic: both endpoints operate on every collection returned by
 * `ControllerConfig.getCollections()`, and none of them need domain-specific query logic here.
 */
export class BackupStore {

    private db: Db;

    constructor(db: Db) {
        this.db = db;
    }

    /**
     * Returns a cursor over every document in the given collection, for streaming to a backup file.
     *
     * @param {string} collectionName - Name of the collection to dump.
     *
     * @returns {FindCursor} A Mongo cursor iterating all documents in the collection.
     */
    findAll(collectionName: string): FindCursor {

        return this.db.collection(collectionName).find({});
    }

    /**
     * Replaces every document in the given collection with the documents from `docs`.
     * Backs `POST /restore` (#102): deletes all existing documents first, then batch-inserts
     * the restored ones, converting each document's `_id` back to an `ObjectId`.
     *
     * @param {string} collectionName - Name of the collection to restore.
     * @param {AsyncIterable<any>} docs - The documents to restore, as read back from a backup file.
     *
     * @returns {Promise<{ count: number; insertedCount: number }>} the count of documents restored.
     */
    async replaceAll(collectionName: string, docs: AsyncIterable<any>): Promise<{ count: number; insertedCount: number }> {

        const collection = this.db.collection(collectionName);

        await collection.deleteMany({});

        let count = 0;
        let insertedCount = 0;
        let batch: any[] = [];

        for await (const doc of docs) {

            doc._id = new ObjectId(String(doc._id));
            batch.push(doc);
            count++;

            if (batch.length === RESTORE_BATCH_SIZE) {
                insertedCount += (await collection.insertMany(batch)).insertedCount;
                batch = [];
            }
        }

        if (batch.length > 0) insertedCount += (await collection.insertMany(batch)).insertedCount;

        return {
            count,
            insertedCount
        };
    }
}
