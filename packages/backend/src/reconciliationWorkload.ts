import { PrismaClient } from "@sourcebot/db";
import { RECONCILIATION_QUEUE } from "@sourcebot/shared";
import { Settings, Workload } from "./types.js";

interface ReconciliationWorkloadDependencies {
    db: PrismaClient;
    settings: Settings;
}

export const createReconciliationWorkload = ({
    db,
    settings,
}: ReconciliationWorkloadDependencies): Workload<'reconciliation'> => ({
    concurrency: 1,
    schedule: { every: '10s' },
    queueSpec: RECONCILIATION_QUEUE,
    process: async ({ logger, trigger }) => {
        const connectionThreshold = new Date(Date.now() - settings.resyncConnectionIntervalMs);
        const connections = await db.connection.findMany({
            where: {
                OR: [
                    { syncedAt: null },
                    { syncedAt: { lt: connectionThreshold } },
                ],
            },
            select: {
                id: true,
                orgId: true,
            },
        });

        await Promise.all(connections.map(async (connection) => {
            logger.debug(`Scheduling connection sync for connection ${connection.id}`);
            await trigger('connection-sync', {
                connectionId: connection.id,
                orgId: connection.orgId,
            });
        }));

        const cleanupThreshold = new Date(Date.now() - settings.repoGarbageCollectionGracePeriodMs);
        const reposToCleanup = await db.repo.findMany({
            where: {
                connections: {
                    none: {},
                },
                isAutoCleanupDisabled: false,
                OR: [
                    { indexedAt: null },
                    { indexedAt: { lt: cleanupThreshold } },
                ],
            },
            select: {
                id: true,
            },
        });

        await Promise.all(reposToCleanup.map(async ({ id }) => {
            logger.debug(`Scheduling cleanup for repo ${id}`);
            await trigger('repo-index', {
                repoId: id,
                type: 'CLEANUP',
            });
        }));

        const indexThreshold = new Date(Date.now() - settings.reindexIntervalMs);
        const reposToIndex = await db.repo.findMany({
            where: {
                OR: [
                    { indexedAt: null },
                    { indexedAt: { lt: indexThreshold } },
                ],
            },
            select: {
                id: true,
            },
        });

        await Promise.all(reposToIndex.map(async ({ id }) => {
            logger.debug(`Scheduling index for repo ${id}`);
            await trigger('repo-index', {
                repoId: id,
                type: 'INDEX',
            });
        }));
    },
});
