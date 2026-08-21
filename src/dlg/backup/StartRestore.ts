import * as readline from "readline";
import { Readable } from "stream";
import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { BackupStore } from "../../store/BackupStore";
import { BackupStorageClient, buildBackupStorageClient } from "../../gcp/BackupStorageClient";
import { BUCKET_FOLDER } from "./StartBackup";

export class StartRestore extends TotoDelegate<StartRestoreRequest, StartRestoreResponse> {

    /** Injectable storage client. If null, lazily initialised from BACKUP_BUCKET on first call. */
    storageClient: BackupStorageClient | null = null;

    parseRequest(req: Request): StartRestoreRequest {

        const date = req.body?.date;

        if (!date) throw new ValidationError(400, "date is required");

        return { date };
    }

    /**
     * Restores every collection listed by `ControllerConfig.getCollections()` that has a backup
     * file for the given date, from `backups/<date>-<collection>.json` in the backup bucket.
     *
     * A collection with no backup file for that date is left untouched (best-effort restore),
     * unless none of them have one, in which case the whole request fails.
     *
     * Each restored collection is fully replaced: its existing documents are deleted, then the
     * backed-up documents are re-inserted with their original `_id` (see `BackupStore.replaceAll`).
     *
     * @param {StartRestoreRequest} req - `{ date }`, the date to restore, formatted YYYYMMDD.
     *
     * @returns {StartRestoreResponse} `{ restore: "done", date, restored, skipped }`.
     */
    async do(req: StartRestoreRequest): Promise<StartRestoreResponse> {

        const config = this.config as ControllerConfig;

        const db = await config.getMongoDb(config.getDBName());
        const store = new BackupStore(db);
        const client = this.storageClient ?? (this.storageClient = buildBackupStorageClient());

        const outcomes = await Promise.all(config.getCollections().map(collectionName => restoreCollection(client, store, collectionName, req.date)));

        const restored = outcomes.filter(outcome => outcome.restored).map(outcome => outcome.collectionName);
        const skipped = outcomes.filter(outcome => !outcome.restored).map(outcome => outcome.collectionName);

        if (restored.length === 0) throw new ValidationError(400, `No backup data available for date [${req.date}]`);

        return { restore: "done", date: req.date, restored, skipped };
    }
}

/**
 * Restores a single collection from its backup file, if one exists for the given date.
 *
 * @param {BackupStorageClient} client - The storage client to check and read the backup file with.
 * @param {BackupStore} store - The store used to replace the collection's content.
 * @param {string} collectionName - Name of the collection to restore.
 * @param {string} date - The date to restore, formatted YYYYMMDD.
 *
 * @returns {Promise<{ collectionName: string; restored: boolean }>} whether the collection had a backup and was restored.
 */
async function restoreCollection(client: BackupStorageClient, store: BackupStore, collectionName: string, date: string): Promise<{ collectionName: string; restored: boolean }> {

    const destination = `${BUCKET_FOLDER}/${date}-${collectionName}.json`;

    const exists = await client.exists(destination);

    if (!exists) return { collectionName, restored: false };

    await store.replaceAll(collectionName, parseJsonLines(client.createReadStream(destination)));

    return { collectionName, restored: true };
}

/**
 * Parses a JSON-lines stream (one JSON document per line) into an async iterable of documents.
 *
 * @param {Readable} stream - The stream to read from.
 *
 * @returns {AsyncGenerator<any>} the parsed documents, in file order.
 */
async function* parseJsonLines(stream: Readable): AsyncGenerator<any> {

    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    for await (const line of rl) {
        if (line.trim().length === 0) continue;
        yield JSON.parse(line);
    }
}

interface StartRestoreRequest {
    date: string;   // Date to restore, formatted YYYYMMDD — same convention as StartBackup's file naming.
}

interface StartRestoreResponse {
    restore: string;      // "done" once every collection has been checked and, where available, restored.
    date: string;          // The date that was restored, echoed back from the request.
    restored: string[];    // Names of collections that had a backup for this date and were restored.
    skipped: string[];     // Names of collections with no backup for this date, left untouched.
}
