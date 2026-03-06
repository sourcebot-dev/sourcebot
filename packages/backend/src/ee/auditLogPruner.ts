import { PrismaClient } from "@sourcebot/db";
import { createLogger, env } from "@sourcebot/shared";
import { setIntervalAsync } from "../utils.js";

const BATCH_SIZE = 10_000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const logger = createLogger('audit-log-pruner');

export class AuditLogPruner {
    private interval?: NodeJS.Timeout;

    constructor(private db: PrismaClient) {}

    startScheduler() {
        if (env.SOURCEBOT_EE_AUDIT_LOGGING_ENABLED !== 'true') {
            logger.info('Audit logging is disabled, skipping audit log pruner.');
            return;
        }

        if (env.SOURCEBOT_EE_AUDIT_RETENTION_DAYS <= 0) {
            logger.info('SOURCEBOT_EE_AUDIT_RETENTION_DAYS is 0, audit log pruning is disabled.');
            return;
        }

        logger.info(`Audit log pruner started. Retaining logs for ${env.SOURCEBOT_EE_AUDIT_RETENTION_DAYS} days.`);

        // Run immediately on startup, then every 24 hours
        this.pruneOldAuditLogs();
        this.interval = setIntervalAsync(() => this.pruneOldAuditLogs(), ONE_DAY_MS);
    }

    async dispose() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = undefined;
        }
    }

    private async pruneOldAuditLogs() {
        const cutoff = new Date(Date.now() - env.SOURCEBOT_EE_AUDIT_RETENTION_DAYS * ONE_DAY_MS);
        let totalDeleted = 0;

        logger.info(`Pruning audit logs older than ${cutoff.toISOString()}...`);

        // Delete in batches to avoid long-running transactions
        while (true) {
            const batch = await this.db.audit.findMany({
                where: { timestamp: { lt: cutoff } },
                select: { id: true },
                take: BATCH_SIZE,
            });

            if (batch.length === 0) break;

            const result = await this.db.audit.deleteMany({
                where: { id: { in: batch.map(r => r.id) } },
            });

            totalDeleted += result.count;

            if (batch.length < BATCH_SIZE) break;
        }

        if (totalDeleted > 0) {
            logger.info(`Pruned ${totalDeleted} audit log records.`);
        } else {
            logger.info('No audit log records to prune.');
        }
    }
}
