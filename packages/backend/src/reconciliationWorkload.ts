import { PrismaClient } from "@sourcebot/db";
import { createLogger, RECONCILIATION_QUEUE } from "@sourcebot/shared";
import { Settings, Workload } from "./types.js";

const logger = createLogger('reconciliation-workload');

interface ReconciliationWorkloadDependencies {
    db: PrismaClient;
    settings: Pick<Settings, 'resyncConnectionIntervalMs'>;
}

export const createReconciliationWorkload = ({
    db,
    settings,
}: ReconciliationWorkloadDependencies): Workload<'reconciliation'> => ({
    concurrency: 1,
    schedule: { every: '15m' },
    queueSpec: RECONCILIATION_QUEUE,
    process: async ({ trigger }) => {
        const thresholdDate = new Date(Date.now() - settings.resyncConnectionIntervalMs);
        const connections = await db.connection.findMany({
            where: {
                OR: [
                    { syncedAt: null },
                    { syncedAt: { lt: thresholdDate } },
                ],
            },
            select: {
                id: true,
                orgId: true,
            },
        });

        await Promise.all(connections.map(async (connection) => {
            logger.debug(`Scheduling connection sync for connection ${connection.id}`);
            await trigger('connection', {
                connectionId: connection.id,
                orgId: connection.orgId,
            });
        }));
    },
});
