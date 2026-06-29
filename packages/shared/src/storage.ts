import { createReadStream as fsCreateReadStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { env } from './env.server.js';

/**
 * App-mediated storage for binary chat attachments. The application always
 * brokers access (no public URLs); callers resolve permissions via the chat
 * linker before reading. A `LocalFsStorageBackend` is provided first; an
 * S3-compatible driver implementing the same contract is planned (Followup B).
 *
 * @note Lives in the shared package so the web app (upload/serve) and the
 * backend worker (orphan pruning) share one implementation and one on-disk
 * layout.
 */
export interface StorageBackend {
    /** Writes the bytes for `key`, overwriting any existing object. */
    put(key: string, data: Buffer): Promise<void>;
    /** Reads the full bytes for `key`. Throws if the object is missing. */
    get(key: string): Promise<Buffer>;
    /**
     * Returns the object's byte size, or `undefined` if it is missing. Lets the
     * serving route detect a missing object before committing response headers.
     */
    stat(key: string): Promise<{ sizeBytes: number } | undefined>;
    /** Opens a Node read stream for `key` (used by the serving route). */
    createReadStream(key: string): Readable;
    /** Deletes the object for `key`. A missing object is not an error. */
    delete(key: string): Promise<void>;
}

/**
 * Stores attachment bytes on the local filesystem under
 * `DATA_CACHE_DIR/attachments`. Keys are opaque, server-generated strings; the
 * backend defensively rejects any key that would resolve outside the base
 * directory (path-traversal guard), even though keys are not client-controlled.
 */
export class LocalFsStorageBackend implements StorageBackend {
    private readonly baseDir: string;

    constructor(baseDir: string = path.join(env.DATA_CACHE_DIR, 'attachments')) {
        this.baseDir = path.resolve(baseDir);
    }

    private resolveKey(key: string): string {
        const resolved = path.resolve(this.baseDir, key);
        // Defense-in-depth: never let a key escape the base directory.
        if (resolved !== this.baseDir && !resolved.startsWith(this.baseDir + path.sep)) {
            throw new Error(`Invalid storage key: ${key}`);
        }
        return resolved;
    }

    async put(key: string, data: Buffer): Promise<void> {
        const filePath = this.resolveKey(key);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, data);
    }

    async get(key: string): Promise<Buffer> {
        return fs.readFile(this.resolveKey(key));
    }

    async stat(key: string): Promise<{ sizeBytes: number } | undefined> {
        try {
            const { size } = await fs.stat(this.resolveKey(key));
            return { sizeBytes: size };
        } catch (error) {
            if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
                return undefined;
            }
            throw error;
        }
    }

    createReadStream(key: string): Readable {
        return fsCreateReadStream(this.resolveKey(key));
    }

    async delete(key: string): Promise<void> {
        try {
            await fs.unlink(this.resolveKey(key));
        } catch (error) {
            if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
                throw error;
            }
        }
    }
}

let storageBackend: StorageBackend | undefined;

/**
 * Returns the process-wide StorageBackend singleton. Local-FS for now; the
 * driver selection (e.g. S3) will be config-driven in Followup B.
 */
export const getStorageBackend = (): StorageBackend => {
    if (!storageBackend) {
        storageBackend = new LocalFsStorageBackend();
    }
    return storageBackend;
};
