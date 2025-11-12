import { Prisma, PrismaClient } from "@sourcebot/db";
import { createLogger } from "@sourcebot/shared";
import { ConnectionConfig } from "@sourcebot/schemas/v3/connection.type";
import { loadConfig } from "@sourcebot/shared";
import chokidar, { FSWatcher } from 'chokidar';
import { ConnectionManager } from "./connectionManager.js";
import { SINGLE_TENANT_ORG_ID } from "./constants.js";
import { syncSearchContexts } from "./ee/syncSearchContexts.js";

const logger = createLogger('config-manager');

export class ConfigManager {
    private watcher: FSWatcher;

    constructor(
        private db: PrismaClient,
        private connectionManager: ConnectionManager,
        configPath: string,
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
            logger.info(`Config file ${configPath} changed. Syncing config.`);
            try {
                await this.syncConfig(configPath);
            } catch (error) {
                logger.error(`Failed to sync config: ${error}`);
            }
        });

        this.syncConfig(configPath);
    }

    private syncConfig = async (configPath: string) => {
        const config = await loadConfig(configPath);

        await this.syncConnections(config.connections);
        await syncSearchContexts({
            contexts: config.contexts,
            orgId: SINGLE_TENANT_ORG_ID,
            db: this.db,
        });
    }

    private syncConnections = async (connections?: { [key: string]: ConnectionConfig }) => {
        if (connections) {
            for (const [key, newConnectionConfig] of Object.entries(connections)) {
                const existingConnection = await this.db.connection.findUnique({
                    where: {
                        name_orgId: {
                            name: key,
                            orgId: SINGLE_TENANT_ORG_ID,
                        }
                    }
                });


                const existingConnectionConfig = existingConnection ? existingConnection.config as unknown as ConnectionConfig : undefined;
                const connectionNeedsSyncing =
                    !existingConnection ||
                    (JSON.stringify(existingConnectionConfig) !== JSON.stringify(newConnectionConfig));

                // Either update the existing connection or create a new one.
                const connection = existingConnection ?
                    await this.db.connection.update({
                        where: {
                            id: existingConnection.id,
                        },
                        data: {
                            config: newConnectionConfig as unknown as Prisma.InputJsonValue,
                            isDeclarative: true,
                        }
                    }) :
                    await this.db.connection.create({
                        data: {
                            name: key,
                            config: newConnectionConfig as unknown as Prisma.InputJsonValue,
                            connectionType: newConnectionConfig.type,
                            isDeclarative: true,
                            org: {
                                connect: {
                                    id: SINGLE_TENANT_ORG_ID,
                                }
                            }
                        }
                    });

                if (connectionNeedsSyncing) {
                    logger.info(`Change detected for connection '${key}' (id: ${connection.id}). Creating sync job.`);
                    await this.connectionManager.createJobs([connection]);
                }
            }
        }

        // Delete any connections that are no longer in the config.
        const deletedConnections = await this.db.connection.findMany({
            where: {
                isDeclarative: true,
                name: {
                    notIn: Object.keys(connections ?? {}),
                },
                orgId: SINGLE_TENANT_ORG_ID,
            }
        });

        for (const connection of deletedConnections) {
            logger.info(`Deleting connection with name '${connection.name}'. Connection ID: ${connection.id}`);
            await this.db.connection.delete({
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