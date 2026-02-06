import * as Sentry from "@sentry/node";
import { Connection, ConnectionSyncJobStatus, PrismaClient } from "@sourcebot/db";
import { ConnectionConfig } from "@sourcebot/schemas/v3/connection.type";
import { createLogger, env, loadConfig } from "@sourcebot/shared";
import { Job, Queue, Worker } from "bullmq";
import { Redis } from 'ioredis';
import { WORKER_STOP_GRACEFUL_TIMEOUT_MS } from "./constants.js";
import { syncSearchContexts } from "./ee/syncSearchContexts.js";
import { captureEvent } from "./posthog.js";
import { PromClient } from "./promClient.js";
import { compileAzureDevOpsConfig, compileBitbucketConfig, compileGenericGitHostConfig, compileGerritConfig, compileGiteaConfig, compileGithubConfig, compileGitlabConfig } from "./repoCompileUtils.js";
import { Settings } from "./types.js";
import { setIntervalAsync } from "./utils.js";

const LOG_TAG = 'connection-manager';
const logger = createLogger(LOG_TAG);
const createJobLogger = (jobId: string) => createLogger(`${LOG_TAG}:job:${jobId}`);
const QUEUE_NAME = 'connection-sync-queue';

const CONNECTION_SYNC_TIMEOUT_MS = 1000 * 60 * 60 * 2; // 2 hours

type JobPayload = {
    jobId: string,
    connectionId: number,
    connectionName: string,
    orgId: number,
};

type JobResult = {
    repoCount: number,
}

export class ConnectionManager {
    private worker: Worker<JobPayload, JobResult>;
    private queue: Queue<JobPayload>;
    private abortController: AbortController;
    private interval?: NodeJS.Timeout;

    constructor(
        private db: PrismaClient,
        private settings: Settings,
        redis: Redis,
        private promClient: PromClient,
    ) {
        this.abortController = new AbortController();

        this.queue = new Queue<JobPayload>(QUEUE_NAME, {
            connection: redis,
            defaultJobOptions: {
                removeOnComplete: env.REDIS_REMOVE_ON_COMPLETE,
                removeOnFail: env.REDIS_REMOVE_ON_FAIL,
                attempts: 2,
            },
        });

        this.worker = new Worker<JobPayload, JobResult>(
            QUEUE_NAME,
            this.runJob.bind(this),
            {
                connection: redis,
                concurrency: this.settings.maxConnectionSyncJobConcurrency,
                maxStalledCount: 1,
            }
        );

        this.worker.on('completed', this.onJobCompleted.bind(this));
        this.worker.on('failed', this.onJobMaybeFailed.bind(this));
        this.worker.on('stalled', (jobId) => {
            // Just log - BullMQ will automatically retry the job (up to maxStalledCount times).
            // If all retries fail, onJobMaybeFailed will handle marking it as failed.
            logger.warn(`Job ${jobId} stalled - BullMQ will retry`);
        });
        this.worker.on('error', (error) => {
            logger.error(`Connection syncer worker error:`, error);
        });
    }

    public startScheduler() {
        logger.debug('Starting scheduler');
        this.interval = setIntervalAsync(async () => {
            const thresholdDate = new Date(Date.now() - this.settings.resyncConnectionIntervalMs);
            const timeoutDate = new Date(Date.now() - CONNECTION_SYNC_TIMEOUT_MS);

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
            await this.queue.add(
                'connection-sync-job',
                {
                    jobId: job.id,
                    connectionId: job.connectionId,
                    connectionName: job.connection.name,
                    orgId: job.connection.orgId,
                },
                { jobId: job.id }
            );

            this.promClient.pendingConnectionSyncJobs.inc({ connection: job.connection.name });
        }

        return jobs.map(job => job.id);
    }

    private async runJob(job: Job<JobPayload>): Promise<JobResult> {
        const { jobId, connectionName } = job.data;
        const logger = createJobLogger(jobId);
        logger.info(`Running connection sync job ${jobId} for connection ${connectionName} (id: ${job.data.connectionId})`);

        const currentStatus = await this.db.connectionSyncJob.findUniqueOrThrow({
            where: {
                id: jobId,
            },
            select: {
                status: true,
            }
        });

        // Fail safe: if the job is not PENDING (first run) or IN_PROGRESS (retry), it indicates the job
        // is in an invalid state and should be skipped.
        if (currentStatus.status !== ConnectionSyncJobStatus.PENDING && currentStatus.status !== ConnectionSyncJobStatus.IN_PROGRESS) {
            throw new Error(`Job ${jobId} is not in a valid state. Expected: ${ConnectionSyncJobStatus.PENDING} or ${ConnectionSyncJobStatus.IN_PROGRESS}. Actual: ${currentStatus.status}. Skipping.`);
        }

        this.promClient.pendingConnectionSyncJobs.dec({ connection: connectionName });
        this.promClient.activeConnectionSyncJobs.inc({ connection: connectionName });

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
                    return await compileGithubConfig(config, job.data.connectionId, this.abortController.signal);
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


    private async onJobCompleted(job: Job<JobPayload>, result: JobResult) {
        try {
            const logger = createJobLogger(job.id!);
            const { connectionId, connectionName, orgId } = job.data;

            await this.db.connectionSyncJob.update({
                where: {
                    id: job.id!,
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

            captureEvent('backend_connection_sync_job_completed', {
                connectionId: connectionId,
                repoCount: result.repoCount,
            });
        } catch (error) {
            Sentry.captureException(error);
            logger.error(`Exception thrown while executing lifecycle function \`onJobCompleted\`.`, error);
        }
    }

    private async onJobMaybeFailed(job: Job<JobPayload> | undefined, error: Error) {
        try {
            if (!job) {
                logger.error(`Job failed but job object is undefined. Error: ${error.message}`);
                return;
            }
            const jobLogger = createJobLogger(job.id!);

            // @note: we need to check the job state to determine if the job failed,
            // or if it is being retried.
            const jobState = await job.getState();
            if (jobState !== 'failed') {
                jobLogger.warn(`Job ${job.id} for connection ${job.data.connectionName} (id: ${job.data.connectionId}) failed. Retrying...`);
                return;
            }

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

            jobLogger.error(`Failed job ${job.id} for connection ${connection.name} (id: ${connection.id}). Failing job.`);

            captureEvent('backend_connection_sync_job_failed', {
                connectionId: job.data.connectionId,
                error: error.message,
            });
        } catch (err) {
            Sentry.captureException(err);
            logger.error(`Exception thrown while executing lifecycle function \`onJobMaybeFailed\`.`, err);
        }
    }

    public async dispose() {
        if (this.interval) {
            clearInterval(this.interval);
        }

        // Signal all active jobs to abort
        this.abortController.abort();

        // Wait for worker to finish with timeout
        await Promise.race([
            this.worker.close(),
            new Promise(resolve => setTimeout(resolve, WORKER_STOP_GRACEFUL_TIMEOUT_MS))
        ]);

        await this.queue.close();
    }
}
