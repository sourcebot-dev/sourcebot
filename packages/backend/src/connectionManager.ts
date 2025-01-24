import { Connection, ConnectionSyncStatus, PrismaClient } from "@sourcebot/db";
import { Job, Queue, Worker } from 'bullmq';
import { AppContext, Settings } from "./types.js";
import { ConnectionConfig } from "@sourcebot/schemas/v3/connection.type";
import { createLogger } from "./logger.js";
import os from 'os';
import { Redis } from 'ioredis';
import { getTokenFromConfig, marshalBool } from "./utils.js";
import { getGitHubReposFromConfig } from "./github.js";

interface IConnectionManager {
    scheduleConnectionSync: (connection: Connection) => Promise<void>;
    dispose: () => void;
}

const QUEUE_NAME = 'configSyncQueue';

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
        settings: Settings,
        redis: Redis,
        private context: AppContext,
    ) {
        const numCores = os.cpus().length;
        this.worker = new Worker(QUEUE_NAME, this.runSyncJob.bind(this), {
            connection: redis,
            concurrency: numCores * settings.configSyncConcurrencyMultiple,
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

    private async runSyncJob(job: Job<JobPayload>) {
        const { config, orgId } = job.data;
        // @note: We aren't actually doing anything with this atm.
        const abortController = new AbortController();

        switch (config.type) {
            case 'github': {
                const token = config.token ? getTokenFromConfig(config.token, this.context) : undefined;
                const gitHubRepos = await getGitHubReposFromConfig(config, abortController.signal, this.context);
                const hostUrl = config.url ?? 'https://github.com';
                const hostname = config.url ? new URL(config.url).hostname : 'github.com';

                await Promise.all(gitHubRepos.map((repo) => {
                    const repoName = `${hostname}/${repo.full_name}`;
                    const cloneUrl = new URL(repo.clone_url!);
                    if (token) {
                        cloneUrl.username = token;
                    }

                    const data = {
                        external_id: repo.id.toString(),
                        external_codeHostType: 'github',
                        external_codeHostUrl: hostUrl,
                        cloneUrl: cloneUrl.toString(),
                        name: repoName,
                        isFork: repo.fork,
                        isArchived: !!repo.archived,
                        orgId,
                        metadata: {
                            'zoekt.web-url-type': 'github',
                            'zoekt.web-url': repo.html_url,
                            'zoekt.name': repoName,
                            'zoekt.github-stars': (repo.stargazers_count ?? 0).toString(),
                            'zoekt.github-watchers': (repo.watchers_count ?? 0).toString(),
                            'zoekt.github-subscribers': (repo.subscribers_count ?? 0).toString(),
                            'zoekt.github-forks': (repo.forks_count ?? 0).toString(),
                            'zoekt.archived': marshalBool(repo.archived),
                            'zoekt.fork': marshalBool(repo.fork),
                            'zoekt.public': marshalBool(repo.private === false)
                        },
                    };

                    return this.db.repo.upsert({
                        where: {
                            external_id_external_codeHostUrl: {
                                external_id: repo.id.toString(),
                                external_codeHostUrl: hostUrl,
                            },
                        },
                        create: data,
                        update: data,
                    })
                }));
                break;
            }
        }
    }


    private async onSyncJobCompleted(job: Job<JobPayload>) {
        this.logger.info(`Config sync job ${job.id} completed`);
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
        this.logger.info(`Config sync job failed with error: ${err}`);
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

