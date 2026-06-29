import { AttachmentStatus, PrismaClient } from "@sourcebot/db";
import { createLogger, env, getStorageBackend } from "@sourcebot/shared";
import { setIntervalAsync } from "./utils.js";

const BATCH_SIZE = 1_000;
const ONE_HOUR_MS = 60 * 60 * 1000;

const logger = createLogger('attachment-pruner');

/**
 * Periodically deletes PENDING (uploaded-but-never-linked) attachment blobs
 * older than the configured TTL, along with their stored bytes. These are the
 * orphans produced when a user selects a file in the chat box but never sends
 * the message. COMMITTED attachments are never touched here; their byte
 * lifecycle is handled by the chat-delete sweep in the web app.
 *
 * @note Byte deletion goes through the shared `StorageBackend`, so the web app
 * and this worker share one on-disk layout (and the S3 driver planned in
 * Followup B).
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
        let totalDeleted = 0;

        while (true) {
            const batch = await this.db.attachment.findMany({
                where: {
                    status: AttachmentStatus.PENDING,
                    createdAt: { lt: cutoff },
                },
                select: { id: true, storageKey: true },
                take: BATCH_SIZE,
            });

            if (batch.length === 0) {
                break;
            }

            await Promise.all(batch.map(async (attachment) => {
                try {
                    await this.storage.delete(attachment.storageKey);
                } catch (error) {
                    logger.warn(`Failed to delete bytes for orphaned attachment ${attachment.id}: ${error}`);
                }
            }));

            // Re-assert the orphan criteria in the delete itself: a concurrent
            // send could have committed (PENDING -> COMMITTED + linked) a row in
            // this batch after the findMany, and deleting by bare id would
            // cascade that live link away.
            const result = await this.db.attachment.deleteMany({
                where: {
                    id: { in: batch.map((attachment) => attachment.id) },
                    status: AttachmentStatus.PENDING,
                    createdAt: { lt: cutoff },
                },
            });
            totalDeleted += result.count;

            if (batch.length < BATCH_SIZE) {
                break;
            }
        }

        if (totalDeleted > 0) {
            logger.debug(`Pruned ${totalDeleted} orphaned PENDING attachment(s).`);
        }
    }
}
