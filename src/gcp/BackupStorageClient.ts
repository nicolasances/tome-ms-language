import { Storage } from "@google-cloud/storage";

/**
 * Contract for uploading a local backup file to cloud storage and pruning an old one.
 * Injectable so `StartBackup` can be unit-tested without a live GCS call.
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
}

/**
 * Builds a `GcsBackupStorageClient` from the `BACKUP_BUCKET` env var.
 */
export function buildBackupStorageClient(): BackupStorageClient {

    const bucketName = process.env.BACKUP_BUCKET;
    if (!bucketName) throw new Error("BACKUP_BUCKET env var is not set");

    return new GcsBackupStorageClient({ bucketName });
}
