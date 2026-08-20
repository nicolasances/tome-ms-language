import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Request } from "express";
import * as moment from "moment-timezone";
import { TotoDelegate, UserContext } from "totoms";
import { ControllerConfig, REFERENCE_TIMEZONE } from "../../Config";
import { BackupStore } from "../../store/BackupStore";
import { BackupStorageClient, buildBackupStorageClient } from "../../gcp/BackupStorageClient";

/**
 * Rolling retention window (in days) for backup files in the bucket: each run deletes the
 * same-named file from this many days ago. Matches the precedent used by sibling Toto
 * microservices (toto-ms-supermarket, toto-ms-expenses).
 */
const BACKUP_RETENTION_DAYS = 2;

export class StartBackup extends TotoDelegate<StartBackupRequest, StartBackupResponse> {

    /** Injectable storage client. If null, lazily initialised from BACKUP_BUCKET on first call. */
    storageClient: BackupStorageClient | null = null;

    parseRequest(_req: Request): StartBackupRequest {

        return {};
    }

    /**
     * Dumps every collection listed by `ControllerConfig.getCollections()` to a local
     * `YYYYMMDD-<collection>.json` file (one JSON document per line), uploads each to the
     * backup bucket, deletes the local copy, then removes the same-named file from
     * `BACKUP_RETENTION_DAYS` days ago to enforce the rolling retention window.
     *
     * @param {StartBackupRequest} _req - Empty request; `POST /backup` takes no input.
     * @param {UserContext} _userContext - The authenticated user context (unused).
     *
     * @returns {StartBackupResponse} `{ backup: "done" }` once every collection has been processed.
     */
    async do(_req: StartBackupRequest, _userContext?: UserContext): Promise<StartBackupResponse> {

        const config = this.config as ControllerConfig;

        const db = await config.getMongoDb(config.getDBName());
        const store = new BackupStore(db);
        const client = this.storageClient ?? (this.storageClient = buildBackupStorageClient());

        const today = moment.tz(REFERENCE_TIMEZONE).format("YYYYMMDD");
        const staleDay = moment.tz(REFERENCE_TIMEZONE).subtract(BACKUP_RETENTION_DAYS, "days").format("YYYYMMDD");

        for (const collectionName of config.getCollections()) {

            const destination = `${today}-${collectionName}.json`;
            const localFilePath = path.join(os.tmpdir(), destination);

            await dumpToFile(store.findAll(collectionName), localFilePath);
            await client.upload(localFilePath, destination);

            fs.rmSync(localFilePath);

            await client.deleteIfExists(`${staleDay}-${collectionName}.json`);
        }

        return { backup: "done" };
    }
}

/**
 * Streams every document of a Mongo cursor to a local file, one JSON document per line (JSONL).
 *
 * @param {AsyncIterable<any>} cursor - The cursor to iterate.
 * @param {string} localFilePath - Path of the local file to write to.
 *
 * @returns {Promise<void>}
 */
async function dumpToFile(cursor: AsyncIterable<any>, localFilePath: string): Promise<void> {

    const writeStream = fs.createWriteStream(localFilePath);

    for await (const doc of cursor) {
        writeStream.write(JSON.stringify(doc) + "\n");
    }

    await new Promise<void>((resolve, reject) => {
        writeStream.end((err: Error | null | undefined) => err ? reject(err) : resolve());
    });
}

interface StartBackupRequest {
}

interface StartBackupResponse {
    backup: string;    // "done" once every collection has been backed up
}
