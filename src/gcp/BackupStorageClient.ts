import { Storage } from "@google-cloud/storage";
import { Readable } from "stream";

/**
 * Contract for uploading, reading back, and pruning backup files in cloud storage.
 * Injectable so `StartBackup` and `StartRestore` can be unit-tested without a live GCS call.
 */
export interface BackupStorageClient {

    /**
     * Uploads a local file to the backup bucket, storing it under `destination`.
     *
     * @param {string} localFilePath - Path of the local file to upload.
     * @param {string} destination - Name the file is stored under in the bucket.
     *
     * @returns {Promise<void>}
     */
    upload(localFilePath: string, destination: string): Promise<void>;

    /**
     * Deletes a file from the backup bucket if it exists. A no-op if it doesn't.
     *
     * @param {string} destination - Name of the file to delete in the bucket.
     *
     * @returns {Promise<void>}
     */
    deleteIfExists(destination: string): Promise<void>;

    /**
     * Checks whether a file is present in the backup bucket.
     *
     * @param {string} destination - Name of the file to look for in the bucket.
     *
     * @returns {Promise<boolean>} true if the file exists, false otherwise.
     */
    exists(destination: string): Promise<boolean>;

    /**
     * Opens a readable stream over a file in the backup bucket, for restoring its content.
     *
     * @param {string} destination - Name of the file to read from the bucket.
     *
     * @returns {Readable} a stream of the file's raw content.
     */
    createReadStream(destination: string): Readable;
}

/**
 * Production implementation backed by a GCS bucket, using ambient GCP service account
 * credentials (standard for Cloud Run services in this project).
 */
export class GcsBackupStorageClient implements BackupStorageClient {

    private bucketName: string;    // Name of the GCS bucket backups are written to.

    constructor({ bucketName }: { bucketName: string }) {
        this.bucketName = bucketName;
    }

    async upload(localFilePath: string, destination: string): Promise<void> {

        const storage = new Storage();

        await storage.bucket(this.bucketName).upload(localFilePath, { destination });
    }

    async deleteIfExists(destination: string): Promise<void> {

        const storage = new Storage();

        await storage.bucket(this.bucketName).file(destination).delete({ ignoreNotFound: true });
    }

    async exists(destination: string): Promise<boolean> {

        const storage = new Storage();

        const [exists] = await storage.bucket(this.bucketName).file(destination).exists();

        return exists;
    }

    createReadStream(destination: string): Readable {

        const storage = new Storage();

        return storage.bucket(this.bucketName).file(destination).createReadStream();
    }
}

/**
 * Builds a `GcsBackupStorageClient` from the `BACKUP_BUCKET` env var.
 */
export function buildBackupStorageClient(): BackupStorageClient {

    const bucketName = `${process.env.GCP_PID}-tome-bucket`;

    return new GcsBackupStorageClient({ bucketName });
}
