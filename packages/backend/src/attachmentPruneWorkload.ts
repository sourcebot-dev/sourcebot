import { AttachmentStatus, type PrismaClient } from "@sourcebot/db";
import {
    ATTACHMENT_PRUNE_QUEUE,
    createLogger,
    getStorageBackend,
    JOB_PRIORITIES,
    type StorageBackend,
} from "@sourcebot/shared";
import type { Workload } from "./types.js";

const BATCH_SIZE = 1_000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const logger = createLogger("attachment-prune-workload");

interface Props {
    db: PrismaClient;
    ttlHours: number;
    storage?: StorageBackend;
}

interface AttachmentPruneResult {
    pendingClaimed: number;
    committedClaimed: number;
    reclaimed: number;
}

/**
 * Reclaims orphaned attachment blobs using the `DELETING` tombstone protocol:
 * an orphan is first atomically flipped to `DELETING`, then its bytes are
 * deleted, and only then is the row removed. Because the row (the only durable
 * handle to the bytes) outlives the byte delete, a failed byte delete is always
 * retryable.
 *
 * Each run condemns two classes of orphan to `DELETING`, then reclaims all
 * tombstones:
 *
 *  1. PENDING (uploaded-but-never-linked): produced when a user selects a file
 *     in the chat box but never sends the message.
 *  2. COMMITTED with zero links: normally a committed blob is reclaimed inline
 *     by the chat-delete sweep in the web app, but this is the backstop for an
 *     interrupted sweep.
 *
 * @note Byte deletion goes through the shared `StorageBackend`, so the web app
 * and this worker share one on-disk layout.
 */
export const createAttachmentPruneWorkload = ({
    db,
    ttlHours,
    storage = getStorageBackend(),
}: Props): Workload<"attachment-prune", AttachmentPruneResult> => ({
    queueSpec: ATTACHMENT_PRUNE_QUEUE,
    concurrency: 1,
    ...(ttlHours > 0
        ? {
              schedule: {
                  interval: "1h",
                  data: {},
                  options: { priority: JOB_PRIORITIES.SCHEDULED },
              },
          }
        : {}),
    process: async () => {
        if (ttlHours <= 0) {
            logger.debug("Attachment orphan pruning is disabled.");
            return {
                pendingClaimed: 0,
                committedClaimed: 0,
                reclaimed: 0,
            };
        }

        const cutoff = new Date(Date.now() - ttlHours * ONE_HOUR_MS);

        // Each claim is atomic, so a PENDING blob committed by a concurrent
        // send or a zero-link blob re-linked by a concurrent duplicate-chat
        // loses the claim and is left intact.
        const pendingClaimed = await db.attachment.updateMany({
            where: {
                status: AttachmentStatus.PENDING,
                createdAt: { lt: cutoff },
            },
            data: { status: AttachmentStatus.DELETING },
        });

        const committedClaimed = await db.attachment.updateMany({
            where: {
                status: AttachmentStatus.COMMITTED,
                createdAt: { lt: cutoff },
                chats: { none: {} },
            },
            data: { status: AttachmentStatus.DELETING },
        });

        const reclaimed = await reclaimTombstonedAttachments({
            db,
            storage,
            warn: (message) => logger.warn(message),
        });

        if (
            pendingClaimed.count > 0 ||
            committedClaimed.count > 0 ||
            reclaimed > 0
        ) {
            logger.debug(
                `Attachment prune: condemned ${pendingClaimed.count} PENDING + ` +
                    `${committedClaimed.count} COMMITTED orphan(s), reclaimed ${reclaimed} tombstone(s).`,
            );
        }

        return {
            pendingClaimed: pendingClaimed.count,
            committedClaimed: committedClaimed.count,
            reclaimed,
        };
    },
});

/**
 * Deletes the bytes for every `DELETING` tombstone, then removes the row. A
 * failed byte delete leaves the tombstone in place for the next scheduled run.
 * Failed IDs are excluded from later batches in this run so a persistent
 * storage failure cannot spin the loop.
 */
const reclaimTombstonedAttachments = async ({
    db,
    storage,
    warn,
}: {
    db: PrismaClient;
    storage: StorageBackend;
    warn: (message: string) => void;
}): Promise<number> => {
    let totalReclaimed = 0;
    const failedIds: string[] = [];

    while (true) {
        const batch = await db.attachment.findMany({
            where: {
                status: AttachmentStatus.DELETING,
                id: { notIn: failedIds },
            },
            select: { id: true, storageKey: true },
            take: BATCH_SIZE,
        });

        if (batch.length === 0) {
            break;
        }

        const settled = await Promise.allSettled(
            batch.map((attachment) => storage.delete(attachment.storageKey)),
        );

        const reclaimedIds: string[] = [];
        batch.forEach((attachment, index) => {
            const outcome = settled[index];
            if (outcome.status === "fulfilled") {
                reclaimedIds.push(attachment.id);
            } else {
                warn(
                    `Failed to delete bytes for tombstoned attachment ${attachment.id}, will retry next run: ${outcome.reason}`,
                );
                failedIds.push(attachment.id);
            }
        });

        if (reclaimedIds.length > 0) {
            const result = await db.attachment.deleteMany({
                where: {
                    id: { in: reclaimedIds },
                    status: AttachmentStatus.DELETING,
                },
            });
            totalReclaimed += result.count;
        }

        if (batch.length < BATCH_SIZE) {
            break;
        }
    }

    return totalReclaimed;
};
