import { Connection, ConnectionSyncStatus, PrismaClient, Prisma } from "@sourcebot/db";
import { Job, Queue, Worker } from 'bullmq';
import { Settings } from "./types.js";
import { ConnectionConfig } from "@sourcebot/schemas/v3/connection.type";
import { createLogger } from "@sourcebot/logger";
import { Redis } from 'ioredis';
import { RepoData, compileGithubConfig, compileGitlabConfig, compileGiteaConfig, compileGerritConfig, compileBitbucketConfig, compileAzureDevOpsConfig, compileGenericGitHostConfig } from "./repoCompileUtils.js";
import { BackendError, BackendException } from "@sourcebot/error";
import { captureEvent } from "./posthog.js";
import { env } from "./env.js";
import * as Sentry from "@sentry/node";
import { loadConfig, syncSearchContexts } from "@sourcebot/shared";

const QUEUE_NAME = 'connectionSyncQueue';

type JobPayload = {
    connectionId: number,
    connectionName: string,
    orgId: number,
    config: ConnectionConfig,
};

type JobResult = {
    repoCount: number,
}

export class ConnectionManager {
    private worker: Worker;
    private queue: Queue<JobPayload>;
    private logger = createLogger('connection-manager');
    private interval?: NodeJS.Timeout;

    constructor(
        private db: PrismaClient,
        private settings: Settings,
        redis: Redis,
    ) {
        this.queue = new Queue<JobPayload>(QUEUE_NAME, {
            connection: redis,
        });
        this.worker = new Worker(QUEUE_NAME, this.runSyncJob.bind(this), {
            connection: redis,
            concurrency: this.settings.maxConnectionSyncJobConcurrency,
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
                connectionName: connection.name,
                orgId: connection.orgId,
                config: connectionConfig,
            }, {
                removeOnComplete: env.REDIS_REMOVE_ON_COMPLETE,
                removeOnFail: env.REDIS_REMOVE_ON_FAIL,
            });
            this.logger.info(`Added job to queue for connection ${connection.name} (id: ${connection.id})`);
        }).catch((err: unknown) => {
            this.logger.error(`Failed to add job to queue for connection ${connection.name} (id: ${connection.id}): ${err}`);
        });
    }

    public startScheduler() {
        this.logger.debug('Starting scheduler');
        this.interval = setInterval(async () => {
            const thresholdDate = new Date(Date.now() - this.settings.resyncConnectionIntervalMs);
            const connections = await this.db.connection.findMany({
                where: {
                    OR: [
                        // When the connection needs to be synced, we want to sync it immediately.
                        {
                            syncStatus: ConnectionSyncStatus.SYNC_NEEDED,
                        },
                        // When the connection has already been synced, we only want to re-sync if the re-sync interval has elapsed
                        // (or if the date isn't set for some reason).
                        {
                            AND: [
                                {
                                    OR: [
                                        { syncStatus: ConnectionSyncStatus.SYNCED },
                                        { syncStatus: ConnectionSyncStatus.SYNCED_WITH_WARNINGS },
                                    ]
                                },
                                {
                                    OR: [
                                        { syncedAt: null },
                                        { syncedAt: { lt: thresholdDate } },
                                    ]
                                }
                            ]
                        }
                    ]
                }
            });
            for (const connection of connections) {
                await this.scheduleConnectionSync(connection);
            }
        }, this.settings.resyncConnectionPollingIntervalMs);
    }

    private async runSyncJob(job: Job<JobPayload>): Promise<JobResult> {
        const { config, orgId, connectionName } = job.data;
        // @note: We aren't actually doing anything with this atm.
        const abortController = new AbortController();

        const connection = await this.db.connection.findUnique({
            where: {
                id: job.data.connectionId,
            },
        });

        if (!connection) {
            const e = new BackendException(BackendError.CONNECTION_SYNC_CONNECTION_NOT_FOUND, {
                message: `Connection ${job.data.connectionId} not found`,
            });
            Sentry.captureException(e);
            throw e;
        }

        // Reset the syncStatusMetadata to an empty object at the start of the sync job
        await this.db.connection.update({
            where: {
                id: job.data.connectionId,
            },
            data: {
                syncStatus: ConnectionSyncStatus.SYNCING,
                syncStatusMetadata: {}
            }
        })


        let result: {
            repoData: RepoData[],
            notFound: {
                users: string[],
                orgs: string[],
                repos: string[],
            }
        } = {
            repoData: [],
            notFound: {
                users: [],
                orgs: [],
                repos: [],
            }
        };

        try {
            result = await (async () => {
                switch (config.type) {
                    case 'github': {
                        return await compileGithubConfig(config, job.data.connectionId, orgId, this.db, abortController);
                    }
                    case 'gitlab': {
                        return await compileGitlabConfig(config, job.data.connectionId, orgId, this.db);
                    }
                    case 'gitea': {
                        return await compileGiteaConfig(config, job.data.connectionId, orgId, this.db);
                    }
                    case 'gerrit': {
                        return await compileGerritConfig(config, job.data.connectionId, orgId);
                    }
                    case 'bitbucket': {
                        return await compileBitbucketConfig(config, job.data.connectionId, orgId, this.db);
                    }
                    case 'azuredevops': {
                        return await compileAzureDevOpsConfig(config, job.data.connectionId, orgId, this.db, abortController);
                    }
                    case 'git': {
                        return await compileGenericGitHostConfig(config, job.data.connectionId, orgId);
                    }
                }
            })();
        } catch (err) {
            this.logger.error(`Failed to compile repo data for connection ${job.data.connectionId} (${connectionName}): ${err}`);
            Sentry.captureException(err);

            if (err instanceof BackendException) {
                throw err;
            } else {
                throw new BackendException(BackendError.CONNECTION_SYNC_SYSTEM_ERROR, {
                    message: `Failed to compile repo data for connection ${job.data.connectionId}`,
                });
            }
        }

        let { repoData, notFound } = result;

        // Push the information regarding not found users, orgs, and repos to the connection's syncStatusMetadata. Note that 
        // this won't be overwritten even if the connection job fails
        await this.db.connection.update({
            where: {
                id: job.data.connectionId,
            },
            data: {
                syncStatusMetadata: { notFound }
            }
        });

        // Filter out any duplicates by external_id and external_codeHostUrl.
        repoData = repoData.filter((repo, index, self) => {
            return index === self.findIndex(r =>
                r.external_id === repo.external_id &&
                r.external_codeHostUrl === repo.external_codeHostUrl
            );
        })

        // @note: to handle orphaned Repos we delete all RepoToConnection records for this connection,
        // and then recreate them when we upsert the repos. For example, if a repo is no-longer
        // captured by the connection's config (e.g., it was deleted, marked archived, etc.), it won't
        // appear in the repoData array above, and so the RepoToConnection record won't be re-created.
        // Repos that have no RepoToConnection records are considered orphaned and can be deleted.
        await this.db.$transaction(async (tx) => {
            const deleteStart = performance.now();
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
            const deleteDuration = performance.now() - deleteStart;
            this.logger.info(`Deleted all RepoToConnection records for connection ${connectionName} (id: ${job.data.connectionId}) in ${deleteDuration}ms`);

            const totalUpsertStart = performance.now();
            for (const repo of repoData) {
                const upsertStart = performance.now();
                await tx.repo.upsert({
                    where: {
                        external_id_external_codeHostUrl_orgId: {
                            external_id: repo.external_id,
                            external_codeHostUrl: repo.external_codeHostUrl,
                            orgId: orgId,
                        }
                    },
                    update: repo,
                    create: repo,
                })
                const upsertDuration = performance.now() - upsertStart;
                this.logger.debug(`Upserted repo ${repo.displayName} (id: ${repo.external_id}) in ${upsertDuration}ms`);
            }
            const totalUpsertDuration = performance.now() - totalUpsertStart;
            this.logger.info(`Upserted ${repoData.length} repos for connection ${connectionName} (id: ${job.data.connectionId}) in ${totalUpsertDuration}ms`);
        }, { timeout: env.CONNECTION_MANAGER_UPSERT_TIMEOUT_MS });

        return {
            repoCount: repoData.length,
        };
    }


    private async onSyncJobCompleted(job: Job<JobPayload>, result: JobResult) {
        this.logger.info(`Connection sync job for connection ${job.data.connectionName} (id: ${job.data.connectionId}, jobId: ${job.id}) completed`);
        const { connectionId, orgId } = job.data;

        let syncStatusMetadata: Record<string, unknown> = (await this.db.connection.findUnique({
            where: { id: connectionId },
            select: { syncStatusMetadata: true }
        }))?.syncStatusMetadata as Record<string, unknown> ?? {};
        const { notFound } = syncStatusMetadata as {
            notFound: {
                users: string[],
                orgs: string[],
                repos: string[],
            }
        };

        await this.db.connection.update({
            where: {
                id: connectionId,
            },
            data: {
                syncStatus:
                    notFound.users.length > 0 ||
                        notFound.orgs.length > 0 ||
                        notFound.repos.length > 0 ? ConnectionSyncStatus.SYNCED_WITH_WARNINGS : ConnectionSyncStatus.SYNCED,
                syncedAt: new Date()
            }
        });

        // After a connection has synced, we need to re-sync the org's search contexts as
        // there may be new repos that match the search context's include/exclude patterns.
        if (env.CONFIG_PATH) {
            try {
                const config = await loadConfig(env.CONFIG_PATH);

                await syncSearchContexts({
                    db: this.db,
                    orgId,
                    contexts: config.contexts,
                });
            } catch (err) {
                this.logger.error(`Failed to sync search contexts for connection ${connectionId}: ${err}`);
                Sentry.captureException(err);
            }
        }


        captureEvent('backend_connection_sync_job_completed', {
            connectionId: connectionId,
            repoCount: result.repoCount,
        });
    }

    private async onSyncJobFailed(job: Job<JobPayload> | undefined, err: unknown) {
        this.logger.info(`Connection sync job for connection ${job?.data.connectionName} (id: ${job?.data.connectionId}, jobId: ${job?.id}) failed with error: ${err}`);
        Sentry.captureException(err, {
            tags: {
                connectionid: job?.data.connectionId,
                jobId: job?.id,
                queue: QUEUE_NAME,
            }
        });

        if (job) {
            const { connectionId } = job.data;

            captureEvent('backend_connection_sync_job_failed', {
                connectionId: connectionId,
                error: err instanceof BackendException ? err.code : 'UNKNOWN',
            });

            // We may have pushed some metadata during the execution of the job, so we make sure to not overwrite the metadata here
            let syncStatusMetadata: Record<string, unknown> = (await this.db.connection.findUnique({
                where: { id: connectionId },
                select: { syncStatusMetadata: true }
            }))?.syncStatusMetadata as Record<string, unknown> ?? {};

            if (err instanceof BackendException) {
                syncStatusMetadata = {
                    ...syncStatusMetadata,
                    error: err.code,
                    ...err.metadata,
                }
            } else {
                syncStatusMetadata = {
                    ...syncStatusMetadata,
                    error: 'UNKNOWN',
                }
            }

            await this.db.connection.update({
                where: {
                    id: connectionId,
                },
                data: {
                    syncStatus: ConnectionSyncStatus.FAILED,
                    syncStatusMetadata: syncStatusMetadata as Prisma.InputJsonValue,
                }
            });
        }
    }

    public async dispose() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        await this.worker.close();
        await this.queue.close();
    }
}

