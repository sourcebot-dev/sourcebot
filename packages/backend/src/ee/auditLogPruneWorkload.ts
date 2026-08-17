import type { PrismaClient } from "@sourcebot/db";
import {
    AUDIT_LOG_PRUNE_QUEUE,
    createLogger,
    JOB_PRIORITIES,
} from "@sourcebot/shared";
import type { Workload } from "../types.js";

const BATCH_SIZE = 10_000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const logger = createLogger("audit-log-prune-workload");

interface Props {
    db: PrismaClient;
    enabled: boolean;
    retentionDays: number;
}

interface AuditLogPruneResult {
    deleted: number;
}

export const createAuditLogPruneWorkload = ({
    db,
    enabled,
    retentionDays,
}: Props): Workload<"audit-log-prune", AuditLogPruneResult> => ({
    queueSpec: AUDIT_LOG_PRUNE_QUEUE,
    concurrency: 1,
    ...(enabled && retentionDays > 0
        ? {
              schedule: {
                  interval: "1d",
                  data: {},
                  options: { priority: JOB_PRIORITIES.SCHEDULED },
              },
          }
        : {}),
    process: async () => {
        if (!enabled || retentionDays <= 0) {
            logger.debug("Audit log pruning is disabled.");
            return { deleted: 0 };
        }

        const cutoff = new Date(Date.now() - retentionDays * ONE_DAY_MS);
        let totalDeleted = 0;

        logger.debug(
            `Pruning audit logs older than ${cutoff.toISOString()}.`,
        );

        // Delete in batches to avoid long-running transactions.
        while (true) {
            const batch = await db.audit.findMany({
                where: { timestamp: { lt: cutoff } },
                select: { id: true },
                take: BATCH_SIZE,
            });

            if (batch.length === 0) {
                break;
            }

            const result = await db.audit.deleteMany({
                where: { id: { in: batch.map(({ id }) => id) } },
            });
            totalDeleted += result.count;

            if (batch.length < BATCH_SIZE) {
                break;
            }
        }

        logger.debug(
            totalDeleted > 0
                ? `Pruned ${totalDeleted} audit log record(s).`
                : "No audit log records to prune.",
        );

        return { deleted: totalDeleted };
    },
});
