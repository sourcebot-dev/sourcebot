import { AttachmentStatus, PrismaClient } from "@sourcebot/db";
import { createLogger, env, getStorageBackend } from "@sourcebot/shared";
import { setIntervalAsync } from "./utils.js";

const BATCH_SIZE = 1_000;
const ONE_HOUR_MS = 60 * 60 * 1000;

const logger = createLogger('attachment-pruner');

/**
 * Periodically reclaims orphaned attachment blobs older than the configured TTL,
 * along with their stored bytes, using the `DELETING` tombstone protocol: an
 * orphan is first atomically flipped to `DELETING`, then its bytes are deleted,
 * and only then is the row removed. Because the row (the only durable handle to
 * the bytes) outlives the byte delete, a failed byte delete is always retryable.
 *
 * Each tick condemns two classes of orphan to `DELETING`, then reclaims all
 * tombstones:
 *
 *  1. PENDING (uploaded-but-never-linked): produced when a user selects a file
 *     in the chat box but never sends the message.
 *  2. COMMITTED with zero links: normally a committed blob is reclaimed inline
 *     by the chat-delete sweep in the web app, but if that sweep is interrupted
 *     (process crash / DB error / failed byte delete) the blob is left tombstoned
 *     or unlinked. This is the backstop for that case.
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

        logger.debug(`Attachment pruner started. Reclaiming orphaned attachments older than ${ttlHours} hours.`);

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

        // Condemn orphans by flipping them to the DELETING tombstone. Each claim
        // is atomic, so a PENDING blob committed by a concurrent send (its commit
        // matches only PENDING rows) or a zero-link blob re-linked by a concurrent
        // duplicate-chat loses the claim and is left intact.
        //
        // PENDING orphans: uploaded but the message was never sent.
        const pendingClaimed = await this.db.attachment.updateMany({
            where: {
                status: AttachmentStatus.PENDING,
                createdAt: { lt: cutoff },
            },
            data: { status: AttachmentStatus.DELETING },
        });

        // COMMITTED orphans: blobs left with zero links by an interrupted
        // chat-delete sweep in the web app.
        const committedClaimed = await this.db.attachment.updateMany({
            where: {
                status: AttachmentStatus.COMMITTED,
                createdAt: { lt: cutoff },
                chats: { none: {} },
            },
            data: { status: AttachmentStatus.DELETING },
        });

        // Reclaim every tombstone: delete bytes, then the row. This also picks up
        // tombstones left behind by the web app's inline reclaim (or a crashed
        // earlier tick) whose byte delete failed.
        const reclaimed = await this.reclaimTombstonedAttachments();

        if (pendingClaimed.count > 0 || committedClaimed.count > 0 || reclaimed > 0) {
            logger.debug(
                `Attachment prune: condemned ${pendingClaimed.count} PENDING + ` +
                `${committedClaimed.count} COMMITTED orphan(s), reclaimed ${reclaimed} tombstone(s).`,
            );
        }
    }

    /**
     * Deletes the bytes for every `DELETING` tombstone, then removes the row.
     * The row (the only durable handle to the bytes) is removed only after its
     * bytes are confirmed gone, so a failed byte delete leaves the tombstone in
     * place to be retried on the next tick — bytes can never be orphaned by a
     * transient storage error. Rows whose byte delete fails this run are
     * excluded from subsequent batches so a persistent failure can't spin the
     * loop.
     *
     * @returns the number of tombstones fully reclaimed (bytes + row).
     */
    private async reclaimTombstonedAttachments(): Promise<number> {
        let totalReclaimed = 0;
        const failedIds: string[] = [];

        while (true) {
            const batch = await this.db.attachment.findMany({
                where: { status: AttachmentStatus.DELETING, id: { notIn: failedIds } },
                select: { id: true, storageKey: true },
                take: BATCH_SIZE,
            });

            if (batch.length === 0) {
                break;
            }

            const settled = await Promise.allSettled(
                batch.map((attachment) => this.storage.delete(attachment.storageKey)));

            const reclaimedIds: string[] = [];
            batch.forEach((attachment, index) => {
                const outcome = settled[index];
                if (outcome.status === 'fulfilled') {
                    reclaimedIds.push(attachment.id);
                } else {
                    logger.warn(`Failed to delete bytes for tombstoned attachment ${attachment.id}, will retry next tick: ${outcome.reason}`);
                    failedIds.push(attachment.id);
                }
            });

            if (reclaimedIds.length > 0) {
                const result = await this.db.attachment.deleteMany({
                    where: { id: { in: reclaimedIds }, status: AttachmentStatus.DELETING },
                });
                totalReclaimed += result.count;
            }

            if (batch.length < BATCH_SIZE) {
                break;
            }
        }

        return totalReclaimed;
    }
}
