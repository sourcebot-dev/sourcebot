import { Prisma } from "@sourcebot/db";
import {
    createLogger,
    env,
    JOB_PRIORITIES,
    loadConfig,
    resolveConfigSettings,
} from "@sourcebot/shared";
import type { ConnectionConfig } from "@sourcebot/schemas/v3/connection.type";
import chokidar, { FSWatcher } from 'chokidar';
import {
    reconcileRepoIndexWork,
    reconcileRepoPermissionSyncWork,
    replaceConnectionRepositories,
} from "./connectionWorkload.js";
import { SINGLE_TENANT_ORG_ID } from "./constants.js";
import { syncSearchContexts } from "./ee/syncSearchContexts.js";
import isEqual from 'fast-deep-equal';
import { prisma } from "./prisma.js";
import type { JobManager, Settings } from "./types.js";

const logger = createLogger('config-manager');
const getConnectionSyncSchedulerId = (connectionId: number) =>
    `connection-sync-v1-${connectionId}`;

export class ConfigManager {
    private watcher: FSWatcher;

    constructor(
        private readonly jobManager: JobManager,
        private readonly configPath: string,
    ) {
        this.watcher = chokidar.watch(configPath, {
            ignoreInitial: true,           // Don't fire events for existing files
            awaitWriteFinish: {
                stabilityThreshold: 100,   // File size stable for 100ms
                pollInterval: 100          // Check every 100ms
            },
            atomic: true                   // Handle atomic writes (temp file + rename)
        });

        this.watcher.on('change', async () => {
            logger.debug(`Config file ${this.configPath} changed. Syncing config.`);
            try {
                await this.syncConfig();
            } catch (error) {
                logger.error(`Failed to sync config: ${error}`);
            }
        });
    }

    public syncConfig = async (): Promise<void> => {
        const config = await loadConfig(this.configPath);
        const settings = resolveConfigSettings(config);

        await this.syncConnections(
            config.connections,
            settings,
        );
        await syncSearchContexts({
            contexts: config.contexts,
            orgId: SINGLE_TENANT_ORG_ID,
        });
    }

    private syncConnections = async (
        connections: { [key: string]: ConnectionConfig } | undefined,
        settings: Settings,
    ) => {
        const connectionIdsToSync: number[] = [];

        if (connections) {
            for (const [key, newConnectionConfig] of Object.entries(connections)) {
                const existingConnection = await prisma.connection.findUnique({
                    where: {
                        name_orgId: {
                            name: key,
                            orgId: SINGLE_TENANT_ORG_ID,
                        }
                    }
                });


                const existingConnectionConfig = existingConnection ? existingConnection.config as unknown as ConnectionConfig : undefined;
                const connectionNeedsSyncing =
                    !existingConnectionConfig ||
                    !isEqual(existingConnectionConfig, newConnectionConfig);

                const enforcePermissions = newConnectionConfig.enforcePermissions ?? (env.PERMISSION_SYNC_ENABLED === 'true');
                const enforcePermissionsForPublicRepos = newConnectionConfig.enforcePermissionsForPublicRepos ?? false;

                // Either update the existing connection or create a new one.
                const connection = existingConnection ?
                    await prisma.connection.update({
                        where: {
                            id: existingConnection.id,
                        },
                        data: {
                            config: newConnectionConfig as unknown as Prisma.InputJsonValue,
                            isDeclarative: true,
                            enforcePermissions,
                            enforcePermissionsForPublicRepos,
                        }
                    }) :
                    await prisma.connection.create({
                        data: {
                            name: key,
                            config: newConnectionConfig as unknown as Prisma.InputJsonValue,
                            connectionType: newConnectionConfig.type,
                            isDeclarative: true,
                            enforcePermissions,
                            enforcePermissionsForPublicRepos,
                            org: {
                                connect: {
                                    id: SINGLE_TENANT_ORG_ID,
                                }
                            }
                        }
                    });

                if (!existingConnection) {
                    await this.jobManager.upsertJobScheduler(
                        "connection-sync",
                        getConnectionSyncSchedulerId(connection.id),
                        settings.resyncConnectionIntervalMs,
                        { connectionId: connection.id },
                        { priority: JOB_PRIORITIES.SCHEDULED },
                    );
                }

                if (connectionNeedsSyncing) {
                    connectionIdsToSync.push(connection.id);
                }
            }
        }

        // Delete any connections that are no longer in the config.
        const deletedConnections = await prisma.connection.findMany({
            where: {
                isDeclarative: true,
                name: {
                    notIn: Object.keys(connections ?? {}),
                },
                orgId: SINGLE_TENANT_ORG_ID,
            }
        });

        await Promise.all(
            connectionIdsToSync.map((connectionId) =>
                this.jobManager.trigger(
                    "connection-sync",
                    { connectionId },
                    { priority: JOB_PRIORITIES.INTERACTIVE },
                ),
            ),
        );

        for (const connection of deletedConnections) {
            logger.info(`Deleting connection with name '${connection.name}'. Connection ID: ${connection.id}`);
            await this.jobManager.removeJobScheduler(
                "connection-sync",
                getConnectionSyncSchedulerId(connection.id),
            );

            const repoChanges = await replaceConnectionRepositories({
                db: prisma,
                connectionId: connection.id,
                orgId: connection.orgId,
                discoveredRepos: [],
            });

            await reconcileRepoIndexWork({
                jobManager: this.jobManager,
                trigger: (workloadName, data, options) =>
                    this.jobManager.trigger(workloadName, data, options),
                currentRepos: repoChanges.currentRepos,
                unindexedRepos: repoChanges.unindexedRepos,
                orphanedRepos: repoChanges.orphanedRepos,
                intervalMs: settings.reindexIntervalMs,
            });

            await reconcileRepoPermissionSyncWork({
                db: prisma,
                jobManager: this.jobManager,
                trigger: (workloadName, data, options) =>
                    this.jobManager.trigger(workloadName, data, options),
                affectedRepoIds: repoChanges.affectedRepoIds,
                intervalMs: settings.repoDrivenPermissionSyncIntervalMs,
            });

            await prisma.connection.delete({
                where: {
                    id: connection.id,
                }
            })
        }
    }

    public dispose = async () => {
        await this.watcher.close();
    }
}
