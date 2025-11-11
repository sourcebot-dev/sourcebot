import * as Sentry from "@sentry/node";
import { Connection, ConnectionSyncJobStatus, PrismaClient } from "@sourcebot/db";
import { createLogger } from "@sourcebot/shared";
import { ConnectionConfig } from "@sourcebot/schemas/v3/connection.type";
import { loadConfig, env } from "@sourcebot/shared";
import { Job, Queue, ReservedJob, Worker } from "groupmq";
import { Redis } from 'ioredis';
import { compileAzureDevOpsConfig, compileBitbucketConfig, compileGenericGitHostConfig, compileGerritConfig, compileGiteaConfig, compileGithubConfig, compileGitlabConfig } from "./repoCompileUtils.js";
import { Settings } from "./types.js";
import { groupmqLifecycleExceptionWrapper, setIntervalAsync } from "./utils.js";
import { syncSearchContexts } from "./ee/syncSearchContexts.js";
import { captureEvent } from "./posthog.js";
import { PromClient } from "./promClient.js";
import { GROUPMQ_WORKER_STOP_GRACEFUL_TIMEOUT_MS } from "./constants.js";

const LOG_TAG = 'connection-manager';
const logger = createLogger(LOG_TAG);
const createJobLogger = (jobId: string) => createLogger(`${LOG_TAG}:job:${jobId}`);
const QUEUE_NAME = 'connection-sync-queue';

type JobPayload = {
    jobId: string,
    connectionId: number,
    connectionName: string,
    orgId: number,
};

type JobResult = {
    repoCount: number,
}

const JOB_TIMEOUT_MS = 1000 * 60 * 60 * 2; // 2 hour timeout

export class ConnectionManager {
    private worker: Worker<JobPayload>;
    private queue: Queue<JobPayload>;
    private interval?: NodeJS.Timeout;

    constructor(
        private db: PrismaClient,
        private settings: Settings,
        private redis: Redis,
        private promClient: PromClient,
    ) {
        this.queue = new Queue<JobPayload>({
            redis,
            namespace: QUEUE_NAME,
            jobTimeoutMs: JOB_TIMEOUT_MS,
            maxAttempts: 3,
            logger: env.DEBUG_ENABLE_GROUPMQ_LOGGING === 'true',
        });

        this.worker = new Worker<JobPayload>({
            queue: this.queue,
            maxStalledCount: 1,
            handler: this.runJob.bind(this),
            concurrency: this.settings.maxConnectionSyncJobConcurrency,
            ...(env.DEBUG_ENABLE_GROUPMQ_LOGGING === 'true' ? {
                logger: true,
            } : {}),
        });

        this.worker.on('completed', this.onJobCompleted.bind(this));
        this.worker.on('failed', this.onJobFailed.bind(this));
        this.worker.on('stalled', this.onJobStalled.bind(this));
        this.worker.on('error', this.onWorkerError.bind(this));
        // graceful-timeout is triggered when a job is still processing after
        // worker.close() is called and the timeout period has elapsed. In this case,
        // we fail the job with no retry.
        this.worker.on('graceful-timeout', this.onJobGracefulTimeout.bind(this));
    }

    public startScheduler() {
        logger.debug('Starting scheduler');
        this.interval = setIntervalAsync(async () => {
            const thresholdDate = new Date(Date.now() - this.settings.resyncConnectionIntervalMs);
            const timeoutDate = new Date(Date.now() - JOB_TIMEOUT_MS);

            const connections = await this.db.connection.findMany({
                where: {
                    AND: [
                        {
                            OR: [
                                { syncedAt: null },
                                { syncedAt: { lt: thresholdDate } },
                            ]
                        },
                        {
                            NOT: {
                                syncJobs: {
                                    some: {
                                        OR: [
                                            // Don't schedule if there are active jobs that were created within the threshold date.
                                            // This handles the case where a job is stuck in a pending state and will never be scheduled.
                                            {
                                                AND: [
                                                    { status: { in: [ConnectionSyncJobStatus.PENDING, ConnectionSyncJobStatus.IN_PROGRESS] } },
                                                    { createdAt: { gt: timeoutDate } },
                                                ]
                                            },
                                            // Don't schedule if there are recent failed jobs (within the threshold date).
                                            {
                                                AND: [
                                                    { status: ConnectionSyncJobStatus.FAILED },
                                                    { completedAt: { gt: thresholdDate } },
                                                ]
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    ]
                }
            });

            if (connections.length > 0) {
                await this.createJobs(connections);
            }
        }, this.settings.resyncConnectionPollingIntervalMs);

        this.worker.run();
    }


    public async createJobs(connections: Connection[]) {
        const jobs = await this.db.connectionSyncJob.createManyAndReturn({
            data: connections.map(connection => ({
                connectionId: connection.id,
            })),
            include: {
                connection: true,
            }
        });

        for (const job of jobs) {
            logger.info(`Scheduling job ${job.id} for connection ${job.connection.name} (id: ${job.connectionId})`);
            await this.queue.add({
                groupId: `connection:${job.connectionId}`,
                data: {
                    jobId: job.id,
                    connectionId: job.connectionId,
                    connectionName: job.connection.name,
                    orgId: job.connection.orgId,
                },
                jobId: job.id,
            });

            this.promClient.pendingConnectionSyncJobs.inc({ connection: job.connection.name });
        }

        return jobs.map(job => job.id);
    }

    private async runJob(job: ReservedJob<JobPayload>): Promise<JobResult> {
        const { jobId, connectionName } = job.data;
        const logger = createJobLogger(jobId);
        logger.info(`Running connection sync job ${jobId} for connection ${connectionName} (id: ${job.data.connectionId}) (attempt ${job.attempts + 1} / ${job.maxAttempts})`);

        const currentStatus = await this.db.connectionSyncJob.findUniqueOrThrow({
            where: {
                id: jobId,
            },
            select: {
                status: true,
            }
        });

        if (currentStatus.status !== ConnectionSyncJobStatus.PENDING && currentStatus.status !== ConnectionSyncJobStatus.IN_PROGRESS) {
            throw new Error(`Job ${jobId} is not in a valid state. Expected: ${ConnectionSyncJobStatus.PENDING} or ${ConnectionSyncJobStatus.IN_PROGRESS}. Actual: ${currentStatus.status}. Skipping.`);
        }


        this.promClient.pendingConnectionSyncJobs.dec({ connection: connectionName });
        this.promClient.activeConnectionSyncJobs.inc({ connection: connectionName });

        // @note: We aren't actually doing anything with this atm.
        const abortController = new AbortController();

        const { connection: { config: rawConnectionConfig, orgId } } = await this.db.connectionSyncJob.update({
            where: {
                id: jobId,
            },
            data: {
                status: ConnectionSyncJobStatus.IN_PROGRESS,
            },
            select: {
                connection: {
                    select: {
                        config: true,
                        orgId: true,
                    }
                }
            },
        });

        const config = rawConnectionConfig as unknown as ConnectionConfig;

        const result = await (async () => {
            switch (config.type) {
                case 'github': {
                    return await compileGithubConfig(config, job.data.connectionId, abortController.signal);
                }
                case 'gitlab': {
                    return await compileGitlabConfig(config, job.data.connectionId);
                }
                case 'gitea': {
                    return await compileGiteaConfig(config, job.data.connectionId);
                }
                case 'gerrit': {
                    return await compileGerritConfig(config, job.data.connectionId);
                }
                case 'bitbucket': {
                    return await compileBitbucketConfig(config, job.data.connectionId);
                }
                case 'azuredevops': {
                    return await compileAzureDevOpsConfig(config, job.data.connectionId);
                }
                case 'git': {
                    return await compileGenericGitHostConfig(config, job.data.connectionId);
                }
            }
        })();

        let { repoData, warnings } = result;

        await this.db.connectionSyncJob.update({
            where: {
                id: jobId,
            },
            data: {
                warningMessages: warnings,
            },
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
            logger.info(`Deleted all RepoToConnection records for connection ${connectionName} (id: ${job.data.connectionId}) in ${deleteDuration}ms`);

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
                logger.debug(`Upserted repo ${repo.displayName} (id: ${repo.external_id}) in ${upsertDuration}ms`);
            }
            const totalUpsertDuration = performance.now() - totalUpsertStart;
            logger.info(`Upserted ${repoData.length} repos for connection ${connectionName} (id: ${job.data.connectionId}) in ${totalUpsertDuration}ms`);
        }, { timeout: env.CONNECTION_MANAGER_UPSERT_TIMEOUT_MS });

        return {
            repoCount: repoData.length,
        };
    }


    private onJobCompleted = async (job: Job<JobPayload>) =>
        groupmqLifecycleExceptionWrapper('onJobCompleted', logger, async () => {
            const logger = createJobLogger(job.id);
            const { connectionId, connectionName, orgId } = job.data;

            await this.db.connectionSyncJob.update({
                where: {
                    id: job.id,
                },
                data: {
                    status: ConnectionSyncJobStatus.COMPLETED,
                    completedAt: new Date(),
                    connection: {
                        update: {
                            syncedAt: new Date(),
                        }
                    }
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
                    logger.error(`Failed to sync search contexts for connection ${connectionId}: ${err}`);
                    Sentry.captureException(err);
                }
            }

            logger.info(`Connection sync job ${job.id} for connection ${job.data.connectionName} (id: ${job.data.connectionId}) completed`);

            this.promClient.activeConnectionSyncJobs.dec({ connection: connectionName });
            this.promClient.connectionSyncJobSuccessTotal.inc({ connection: connectionName });

            const result = job.returnvalue as JobResult;
            captureEvent('backend_connection_sync_job_completed', {
                connectionId: connectionId,
                repoCount: result.repoCount,
            });
        });

    private onJobFailed = async (job: Job<JobPayload>) =>
        groupmqLifecycleExceptionWrapper('onJobFailed', logger, async () => {
            const logger = createJobLogger(job.id);

            const attempt = job.attemptsMade + 1;
            const wasLastAttempt = attempt >= job.opts.attempts;

            if (wasLastAttempt) {
                const { connection } = await this.db.connectionSyncJob.update({
                    where: { id: job.id },
                    data: {
                        status: ConnectionSyncJobStatus.FAILED,
                        completedAt: new Date(),
                        errorMessage: job.failedReason,
                    },
                    select: {
                        connection: true,
                    }
                });

                this.promClient.activeConnectionSyncJobs.dec({ connection: connection.name });
                this.promClient.connectionSyncJobFailTotal.inc({ connection: connection.name });

                logger.error(`Failed job ${job.id} for connection ${connection.name} (id: ${connection.id}). Attempt ${attempt} / ${job.opts.attempts}. Failing job.`);
            } else {
                const connection = await this.db.connection.findUniqueOrThrow({
                    where: { id: job.data.connectionId },
                });

                this.promClient.connectionSyncJobReattemptsTotal.inc({ connection: connection.name });

                logger.warn(`Failed job ${job.id} for connection ${connection.name} (id: ${connection.id}). Attempt ${attempt} / ${job.opts.attempts}. Retrying.`);
            }

            captureEvent('backend_connection_sync_job_failed', {
                connectionId: job.data.connectionId,
                error: job.failedReason,
            });
        });

    private onJobStalled = async (jobId: string) =>
        groupmqLifecycleExceptionWrapper('onJobStalled', logger, async () => {
            const logger = createJobLogger(jobId);
            const { connection } = await this.db.connectionSyncJob.update({
                where: { id: jobId },
                data: {
                    status: ConnectionSyncJobStatus.FAILED,
                    completedAt: new Date(),
                    errorMessage: 'Job stalled',
                },
                select: {
                    connection: true,
                }
            });

            this.promClient.activeConnectionSyncJobs.dec({ connection: connection.name });
            this.promClient.connectionSyncJobFailTotal.inc({ connection: connection.name });

            logger.error(`Job ${jobId} stalled for connection ${connection.name} (id: ${connection.id})`);

            captureEvent('backend_connection_sync_job_failed', {
                connectionId: connection.id,
                error: 'Job stalled',
            });
        });

    private onJobGracefulTimeout = async (job: Job<JobPayload>) =>
        groupmqLifecycleExceptionWrapper('onJobGracefulTimeout', logger, async () => {
            const logger = createJobLogger(job.id);

            const { connection } = await this.db.connectionSyncJob.update({
                where: { id: job.id },
                data: {
                    status: ConnectionSyncJobStatus.FAILED,
                    completedAt: new Date(),
                    errorMessage: 'Job timed out',
                },
                select: {
                    connection: true,
                }
            });

            this.promClient.activeConnectionSyncJobs.dec({ connection: connection.name });
            this.promClient.connectionSyncJobFailTotal.inc({ connection: connection.name });

            logger.error(`Job ${job.id} timed out for connection ${connection.name} (id: ${connection.id})`);

            captureEvent('backend_connection_sync_job_failed', {
                connectionId: connection.id,
                error: 'Job timed out',
            });
        });

    private async onWorkerError(error: Error) {
        Sentry.captureException(error);
        logger.error(`Connection syncer worker error.`, error);
    }

    public async dispose() {
        if (this.interval) {
            clearInterval(this.interval);
        }

        const inProgressJobs = this.worker.getCurrentJobs();
        await this.worker.close(GROUPMQ_WORKER_STOP_GRACEFUL_TIMEOUT_MS);

        // Manually release group locks for in progress jobs to prevent deadlocks.
        // @see: https://github.com/Openpanel-dev/groupmq/issues/8
        for (const { job } of inProgressJobs) {
            const lockKey = `groupmq:${QUEUE_NAME}:lock:${job.groupId}`;
            logger.debug(`Releasing group lock ${lockKey} for in progress job ${job.id}`);
            try {
                await this.redis.del(lockKey);
            } catch (error) {
                Sentry.captureException(error);
                logger.error(`Failed to release group lock ${lockKey} for in progress job ${job.id}. Error: `, error);
            }
        }

        // @note: As of groupmq v1.0.0, queue.close() will just close the underlying
        // redis connection. Since we share the same redis client between, skip this
        // step and close the redis client directly in index.ts.
        // @see: https://github.com/Openpanel-dev/groupmq/blob/main/src/queue.ts#L1900
        // await this.queue.close();
    }
}

