import { AttachmentStatus, Prisma, PrismaClient } from "@sourcebot/db";
import { createLogger, env, getStorageBackend } from "@sourcebot/shared";
import { setIntervalAsync } from "./utils.js";

const BATCH_SIZE = 1_000;
const ONE_HOUR_MS = 60 * 60 * 1000;

const logger = createLogger('attachment-pruner');

/**
 * Periodically deletes orphaned attachment blobs older than the configured TTL,
 * along with their stored bytes. Two classes of orphan are swept:
 *
 *  1. PENDING (uploaded-but-never-linked): produced when a user selects a file
 *     in the chat box but never sends the message.
 *  2. COMMITTED with zero links: normally a committed blob is reclaimed inline
 *     by the chat-delete sweep in the web app, but if that sweep is interrupted
 *     (process crash / DB error after the chat row is deleted) the blob is left
 *     with no link and no PENDING status. This is the backstop for that case.
 *
 * @note Byte deletion goes through the shared `StorageBackend`, so the web app
 * and this worker share one on-disk layout.
 */
export class AttachmentPruner {
    private interval?: NodeJS.Timeout;
    private readonly storage = getStorageBackend();

    constructor(private db: PrismaClient) {}

    startScheduler() {
        const ttlHours = env.SOURCEBOT_CHAT_ATTACHMENT_ORPHAN_TTL_HOURS;
        if (ttlHours <= 0) {
            logger.info('SOURCEBOT_CHAT_ATTACHMENT_ORPHAN_TTL_HOURS is 0, attachment orphan pruning is disabled.');
            return;
        }

        logger.debug(`Attachment pruner started. Pruning PENDING attachments older than ${ttlHours} hours.`);

        // Run immediately on startup, then every hour. The startup call isn't
        // awaited, so log any failure here: this worker exits on
        // unhandledRejection, and the recurring schedule will retry.
        this.pruneOrphanedAttachments().catch((error) => {
            logger.warn(`Initial attachment prune failed: ${error}`);
        });
        this.interval = setIntervalAsync(() => this.pruneOrphanedAttachments(), ONE_HOUR_MS);
    }

    async dispose() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = undefined;
        }
    }

    private async pruneOrphanedAttachments() {
        const cutoff = new Date(Date.now() - env.SOURCEBOT_CHAT_ATTACHMENT_ORPHAN_TTL_HOURS * ONE_HOUR_MS);

        // PENDING orphans: uploaded but the message was never sent.
        const pendingDeleted = await this.sweep({
            status: AttachmentStatus.PENDING,
            createdAt: { lt: cutoff },
        });
        if (pendingDeleted > 0) {
            logger.debug(`Pruned ${pendingDeleted} orphaned PENDING attachment(s).`);
        }

        // COMMITTED orphans: blobs left with zero links by an interrupted
        // chat-delete sweep in the web app.
        const committedDeleted = await this.sweep({
            status: AttachmentStatus.COMMITTED,
            createdAt: { lt: cutoff },
            chats: { none: {} },
        });
        if (committedDeleted > 0) {
            logger.debug(`Pruned ${committedDeleted} orphaned COMMITTED attachment(s).`);
        }
    }

    /**
     * Deletes attachments matching `where` in batches, byte-safe under
     * concurrency. The DB row is deleted first, re-asserting `where` in the
     * delete so a row that changed since the read (e.g. a PENDING blob committed
     * by a concurrent send, or a zero-link blob re-linked by a concurrent
     * duplicate-chat) survives. Bytes are then deleted only for rows that no
     * longer exist — the rows this sweep actually removed. A deleted row can
     * never reappear and a surviving row is never deleted by this loop, so the
     * "still exists" check cannot misclassify either way.
     *
     * @returns the number of DB rows deleted.
     */
    private async sweep(where: Prisma.AttachmentWhereInput): Promise<number> {
        let totalDeleted = 0;

        while (true) {
            const batch = await this.db.attachment.findMany({
                where,
                select: { id: true, storageKey: true },
                take: BATCH_SIZE,
            });

            if (batch.length === 0) {
                break;
            }

            const batchIds = batch.map((attachment) => attachment.id);

            const result = await this.db.attachment.deleteMany({
                where: { AND: [where, { id: { in: batchIds } }] },
            });
            totalDeleted += result.count;

            // Any id still present got committed/re-linked concurrently and must
            // keep its bytes; the rest were deleted by us and are safe to sweep.
            const survivors = await this.db.attachment.findMany({
                where: { id: { in: batchIds } },
                select: { id: true },
            });
            const survivorIds = new Set(survivors.map((survivor) => survivor.id));

            await Promise.all(batch
                .filter((attachment) => !survivorIds.has(attachment.id))
                .map((attachment) => this.storage.delete(attachment.storageKey).catch((error) => {
                    logger.warn(`Failed to delete bytes for orphaned attachment ${attachment.id}: ${error}`);
                })));

            if (batch.length < BATCH_SIZE) {
                break;
            }
        }

        return totalDeleted;
    }
}
