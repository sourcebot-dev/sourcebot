import { Connection, ConnectionSyncStatus, PrismaClient, Prisma } from "@sourcebot/db";
import { Job, Queue, Worker } from 'bullmq';
import { Settings, WithRequired } from "./types.js";
import { ConnectionConfig } from "@sourcebot/schemas/v3/connection.type";
import { createLogger } from "./logger.js";
import os from 'os';
import { Redis } from 'ioredis';
import { RepoData, compileGithubConfig, compileGitlabConfig } from "./repoCompileUtils.js";

interface IConnectionManager {
    scheduleConnectionSync: (connection: Connection) => Promise<void>;
    registerPollingCallback: () => void;
    dispose: () => void;
}

const QUEUE_NAME = 'connectionSyncQueue';

type JobPayload = {
    connectionId: number,
    orgId: number,
    config: ConnectionConfig,
};

export class ConnectionManager implements IConnectionManager {
    private queue = new Queue<JobPayload>(QUEUE_NAME);
    private worker: Worker;
    private logger = createLogger('ConnectionManager');

    constructor(
        private db: PrismaClient,
        private settings: Settings,
        redis: Redis,
    ) {
        const numCores = os.cpus().length;
        this.worker = new Worker(QUEUE_NAME, this.runSyncJob.bind(this), {
            connection: redis,
            concurrency: numCores * this.settings.configSyncConcurrencyMultiple,
        });
        this.worker.on('completed', this.onSyncJobCompleted.bind(this));
        this.worker.on('failed', this.onSyncJobFailed.bind(this));
    }

    public async scheduleConnectionSync(connection: Connection) {
        await this.db.$transaction(async (tx) => {
            await tx.connection.update({
                where: { id: connection.id },
                data: { syncStatus: ConnectionSyncStatus.IN_SYNC_QUEUE },
            });

            const connectionConfig = connection.config as unknown as ConnectionConfig;

            await this.queue.add('connectionSyncJob', {
                connectionId: connection.id,
                orgId: connection.orgId,
                config: connectionConfig,
            });
            this.logger.info(`Added job to queue for connection ${connection.id}`);
        }).catch((err: unknown) => {
            this.logger.error(`Failed to add job to queue for connection ${connection.id}: ${err}`);
        });
    }

    public async registerPollingCallback() {
        setInterval(async () => {
            const connections = await this.db.connection.findMany({
                where: {
                    syncStatus: ConnectionSyncStatus.SYNC_NEEDED,
                }
            });
            for (const connection of connections) {
                await this.scheduleConnectionSync(connection);
            }
        }, this.settings.resyncConnectionPollingIntervalMs);
    }

    private async runSyncJob(job: Job<JobPayload>) {
        const { config, orgId } = job.data;
        // @note: We aren't actually doing anything with this atm.
        const abortController = new AbortController();

        const repoData: RepoData[] = await (async () => {
            switch (config.type) {
                case 'github': {
                    return await compileGithubConfig(config, job.data.connectionId, orgId, this.db, abortController);
                }
                case 'gitlab': {
                    return await compileGitlabConfig(config, job.data.connectionId, orgId, this.db);
                }
                default: {
                    return [];
                }
            }
        })();

        // @note: to handle orphaned Repos we delete all RepoToConnection records for this connection,
        // and then recreate them when we upsert the repos. For example, if a repo is no-longer
        // captured by the connection's config (e.g., it was deleted, marked archived, etc.), it won't
        // appear in the repoData array above, and so the RepoToConnection record won't be re-created.
        // Repos that have no RepoToConnection records are considered orphaned and can be deleted.
        await this.db.$transaction(async (tx) => {
            await tx.connection.update({
                where: {
                    id: job.data.connectionId,
                },
                data: {
                    repos: {
                        deleteMany: {}
                    }
                }
            });

            await Promise.all(repoData.map((repo) => {
                return tx.repo.upsert({
                    where: {
                        external_id_external_codeHostUrl: {
                            external_id: repo.external_id,
                            external_codeHostUrl: repo.external_codeHostUrl,
                        },
                    },
                    create: repo,
                    update: repo as Prisma.RepoUpdateInput,
                });
            }));

        });
    }


    private async onSyncJobCompleted(job: Job<JobPayload>) {
        this.logger.info(`Connection sync job ${job.id} completed`);
        const { connectionId } = job.data;

        await this.db.connection.update({
            where: {
                id: connectionId,
            },
            data: {
                syncStatus: ConnectionSyncStatus.SYNCED,
                syncedAt: new Date()
            }
        })
    }

    private async onSyncJobFailed(job: Job | undefined, err: unknown) {
        this.logger.info(`Connection sync job failed with error: ${err}`);
        if (job) {
            const { connectionId } = job.data;
            await this.db.connection.update({
                where: {
                    id: connectionId,
                },
                data: {
                    syncStatus: ConnectionSyncStatus.FAILED,
                    syncedAt: new Date()
                }
            })
        }
    }

    public dispose() {
        this.worker.close();
        this.queue.close();
    }
}

