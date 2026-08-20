import { Db, FindCursor } from "mongodb";

/**
 * Generic Mongo access backing `POST /backup` (#100). Unlike the other Store classes, which are
 * scoped to a single domain collection, this one is deliberately collection-agnostic: the backup
 * endpoint dumps every collection returned by `ControllerConfig.getCollections()`, and none of
 * them need domain-specific query logic here.
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
}
