import { PrismaClient } from "@sourcebot/db";
import { env, PERMISSION_SYNC_SUPPORTED_CODE_HOST_TYPES, PERMISSION_SYNC_SUPPORTED_IDENTITY_PROVIDERS, RECONCILIATION_QUEUE } from "@sourcebot/shared";
import { hasEntitlement } from "./entitlements.js";
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
        // Connections
        {
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
                await trigger('connection-sync', {
                    connectionId: connection.id,
                    orgId: connection.orgId,
                });
            }));
        }

        // Repo garbage collection
        {
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
        }

        // Repo indexing
        {
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
                await trigger('repo-index', {
                    repoId: id,
                    type: 'INDEX',
                });
            }));
        }

        // Permission syncing
        if (
            env.PERMISSION_SYNC_ENABLED === 'true' &&
            await hasEntitlement('permission-syncing')
        ) {
            const accountThreshold = new Date(Date.now() - settings.userDrivenPermissionSyncIntervalMs);
            const accounts = await db.account.findMany({
                where: {
                    AND: [
                        {
                            providerType: {
                                in: PERMISSION_SYNC_SUPPORTED_IDENTITY_PROVIDERS,
                            },
                        },
                        {
                            OR: [
                                { permissionSyncedAt: null },
                                { permissionSyncedAt: { lt: accountThreshold } },
                            ],
                        },
                    ],
                },
                select: {
                    id: true,
                },
            });

            await Promise.all(accounts.map(async ({ id }) => {
                await trigger('account-permission-sync', {
                    accountId: id,
                });
            }));

            const repoThreshold = new Date(Date.now() - settings.repoDrivenPermissionSyncIntervalMs);
            const repos = await db.repo.findMany({
                where: {
                    AND: [
                        {
                            isPublic: false,
                        },
                        {
                            external_codeHostType: {
                                in: PERMISSION_SYNC_SUPPORTED_CODE_HOST_TYPES,
                            },
                        },
                        {
                            connections: {
                                some: {
                                    connection: {
                                        enforcePermissions: true,
                                    },
                                },
                            },
                        },
                        {
                            OR: [
                                { permissionSyncedAt: null },
                                { permissionSyncedAt: { lt: repoThreshold } },
                            ],
                        },
                    ],
                },
                select: {
                    id: true,
                },
            });

            await Promise.all(repos.map(async ({ id }) => {
                await trigger('repo-permission-sync', {
                    repoId: id,
                });
            }));
        }
    },
});
