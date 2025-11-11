import * as Sentry from '@sentry/node';
import { PrismaClient, Repo, RepoIndexingJobStatus, RepoIndexingJobType } from "@sourcebot/db";
import { createLogger, Logger } from "@sourcebot/shared";
import { env, RepoIndexingJobMetadata, repoIndexingJobMetadataSchema, RepoMetadata, repoMetadataSchema } from '@sourcebot/shared';
import { existsSync } from 'fs';
import { readdir, rm } from 'fs/promises';
import { Job, Queue, ReservedJob, Worker } from "groupmq";
import { Redis } from 'ioredis';
import micromatch from 'micromatch';
import { GROUPMQ_WORKER_STOP_GRACEFUL_TIMEOUT_MS, INDEX_CACHE_DIR } from './constants.js';
import { cloneRepository, fetchRepository, getBranches, getCommitHashForRefName, getTags, isPathAValidGitRepoRoot, unsetGitConfig, upsertGitConfig } from './git.js';
import { captureEvent } from './posthog.js';
import { PromClient } from './promClient.js';
import { RepoWithConnections, Settings } from "./types.js";
import { getAuthCredentialsForRepo, getRepoPath, getShardPrefix, groupmqLifecycleExceptionWrapper, measure, setIntervalAsync } from './utils.js';
import { indexGitRepository } from './zoekt.js';

const LOG_TAG = 'repo-index-manager';
const logger = createLogger(LOG_TAG);
const createJobLogger = (jobId: string) => createLogger(`${LOG_TAG}:job:${jobId}`);

type JobPayload = {
    type: 'INDEX' | 'CLEANUP';
    jobId: string;
    repoId: number;
    repoName: string;
};

/**
 * Manages the lifecycle of repository data on disk, including git working copies
 * and search index shards. Handles both indexing operations (cloning/fetching repos
 * and building search indexes) and cleanup operations (removing orphaned repos and
 * their associated data).
 * 
 * Uses a job queue system to process indexing and cleanup tasks asynchronously,
 * with configurable concurrency limits and retry logic. Automatically schedules
 * re-indexing of repos based on configured intervals and manages garbage collection
 * of repos that are no longer connected to any source.
 */
export class RepoIndexManager {
    private interval?: NodeJS.Timeout;
    private queue: Queue<JobPayload>;
    private worker: Worker<JobPayload>;

    constructor(
        private db: PrismaClient,
        private settings: Settings,
        private redis: Redis,
        private promClient: PromClient,
    ) {
        this.queue = new Queue<JobPayload>({
            redis,
            namespace: 'repo-index-queue',
            jobTimeoutMs: this.settings.repoIndexTimeoutMs,
            maxAttempts: 3,
            logger: env.DEBUG_ENABLE_GROUPMQ_LOGGING === 'true',
        });

        this.worker = new Worker<JobPayload>({
            queue: this.queue,
            maxStalledCount: 1,
            handler: this.runJob.bind(this),
            concurrency: this.settings.maxRepoIndexingJobConcurrency,
            ...(env.DEBUG_ENABLE_GROUPMQ_LOGGING === 'true' ? {
                logger: true,
            } : {}),
        });

        this.worker.on('completed', this.onJobCompleted.bind(this));
        this.worker.on('failed', this.onJobFailed.bind(this));
        this.worker.on('graceful-timeout', this.onJobGracefulTimeout.bind(this));
        this.worker.on('stalled', this.onJobStalled.bind(this));
        this.worker.on('error', this.onWorkerError.bind(this));
    }

    public startScheduler() {
        logger.debug('Starting scheduler');
        this.interval = setIntervalAsync(async () => {
            await this.scheduleIndexJobs();
            await this.scheduleCleanupJobs();
        }, this.settings.reindexRepoPollingIntervalMs);

        this.worker.run();
    }

    private async scheduleIndexJobs() {
        const thresholdDate = new Date(Date.now() - this.settings.reindexIntervalMs);
        const timeoutDate = new Date(Date.now() - this.settings.repoIndexTimeoutMs);

        const reposToIndex = await this.db.repo.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { indexedAt: null },
                            { indexedAt: { lt: thresholdDate } },
                        ]
                    },
                    {
                        NOT: {
                            jobs: {
                                some: {
                                    AND: [
                                        {
                                            type: RepoIndexingJobType.INDEX,
                                        },
                                        {
                                            OR: [
                                                // Don't schedule if there are active jobs that were created within the threshold date.
                                                // This handles the case where a job is stuck in a pending state and will never be scheduled.
                                                {
                                                    AND: [
                                                        {
                                                            status: {
                                                                in: [
                                                                    RepoIndexingJobStatus.PENDING,
                                                                    RepoIndexingJobStatus.IN_PROGRESS,
                                                                ]
                                                            },
                                                        },
                                                        {
                                                            createdAt: {
                                                                gt: timeoutDate,
                                                            }
                                                        }
                                                    ]
                                                },
                                                // Don't schedule if there are recent failed jobs (within the threshold date).
                                                {
                                                    AND: [
                                                        { status: RepoIndexingJobStatus.FAILED },
                                                        { completedAt: { gt: thresholdDate } },
                                                    ]
                                                }
                                            ]
                                        }
                                    ]
                                }
                            }
                        }
                    }
                ],
            },
        });

        if (reposToIndex.length > 0) {
            await this.createJobs(reposToIndex, RepoIndexingJobType.INDEX);
        }
    }

    private async scheduleCleanupJobs() {
        const gcGracePeriodMs = new Date(Date.now() - this.settings.repoGarbageCollectionGracePeriodMs);
        const timeoutDate = new Date(Date.now() - this.settings.repoIndexTimeoutMs);

        const reposToCleanup = await this.db.repo.findMany({
            where: {
                connections: {
                    none: {}
                },
                OR: [
                    { indexedAt: null },
                    { indexedAt: { lt: gcGracePeriodMs } },
                ],
                NOT: {
                    jobs: {
                        some: {
                            AND: [
                                {
                                    type: RepoIndexingJobType.CLEANUP,
                                },
                                {
                                    status: {
                                        in: [
                                            RepoIndexingJobStatus.PENDING,
                                            RepoIndexingJobStatus.IN_PROGRESS,
                                        ]
                                    },
                                },
                                {
                                    createdAt: {
                                        gt: timeoutDate,
                                    }
                                }
                            ]
                        }
                    }
                }
            }
        });

        if (reposToCleanup.length > 0) {
            await this.createJobs(reposToCleanup, RepoIndexingJobType.CLEANUP);
        }
    }

    public async createJobs(repos: Repo[], type: RepoIndexingJobType) {
        // @note: we don't perform this in a transaction because
        // we want to avoid the situation where a job is created and run
        // prior to the transaction being committed.
        const jobs = await this.db.repoIndexingJob.createManyAndReturn({
            data: repos.map(repo => ({
                type,
                repoId: repo.id,
            })),
            include: {
                repo: true,
            }
        });

        for (const job of jobs) {
            await this.queue.add({
                groupId: `repo:${job.repoId}`,
                data: {
                    jobId: job.id,
                    type,
                    repoName: job.repo.name,
                    repoId: job.repo.id,
                },
                jobId: job.id,
            });

            const jobTypeLabel = getJobTypePrometheusLabel(type);
            this.promClient.pendingRepoIndexJobs.inc({ repo: job.repo.name, type: jobTypeLabel });
        }

        return jobs.map(job => job.id);
    }

    private async runJob(job: ReservedJob<JobPayload>) {
        const id = job.data.jobId;
        const logger = createJobLogger(id);
        logger.info(`Running ${job.data.type} job ${id} for repo ${job.data.repoName} (id: ${job.data.repoId}) (attempt ${job.attempts + 1} / ${job.maxAttempts})`);


        const { repo, type: jobType } = await this.db.repoIndexingJob.update({
            where: {
                id,
            },
            data: {
                status: RepoIndexingJobStatus.IN_PROGRESS,
            },
            select: {
                type: true,
                repo: {
                    include: {
                        connections: {
                            include: {
                                connection: true,
                            }
                        }
                    }
                }
            }
        });

        const jobTypeLabel = getJobTypePrometheusLabel(jobType);
        this.promClient.pendingRepoIndexJobs.dec({ repo: job.data.repoName, type: jobTypeLabel });
        this.promClient.activeRepoIndexJobs.inc({ repo: job.data.repoName, type: jobTypeLabel });

        const abortController = new AbortController();
        const signalHandler = () => {
            logger.info(`Received shutdown signal, aborting...`);
            abortController.abort(); // This cancels all operations
        };

        process.on('SIGTERM', signalHandler);
        process.on('SIGINT', signalHandler);

        try {
            if (jobType === RepoIndexingJobType.INDEX) {
                const revisions = await this.indexRepository(repo, logger, abortController.signal);

                await this.db.repoIndexingJob.update({
                    where: { id },
                    data: {
                        metadata: {
                            indexedRevisions: revisions,
                        } satisfies RepoIndexingJobMetadata,
                    },
                });
            } else if (jobType === RepoIndexingJobType.CLEANUP) {
                await this.cleanupRepository(repo, logger);
            }
        } finally {
            process.off('SIGTERM', signalHandler);
            process.off('SIGINT', signalHandler);
        }
    }

    private async indexRepository(repo: RepoWithConnections, logger: Logger, signal: AbortSignal) {
        const { path: repoPath, isReadOnly } = getRepoPath(repo);

        const metadata = repoMetadataSchema.parse(repo.metadata);

        const credentials = await getAuthCredentialsForRepo(repo);
        const cloneUrlMaybeWithToken = credentials?.cloneUrlWithToken ?? repo.cloneUrl;
        const authHeader = credentials?.authHeader ?? undefined;

        // If the repo path exists but it is not a valid git repository root, this indicates
        // that the repository is in a bad state. To fix, we remove the directory and perform
        // a fresh clone.
        if (existsSync(repoPath) && !(await isPathAValidGitRepoRoot({ path: repoPath }))) {
            const isValidGitRepo = await isPathAValidGitRepoRoot({
                path: repoPath,
                signal,
            });

            if (!isValidGitRepo && !isReadOnly) {
                logger.warn(`${repoPath} is not a valid git repository root. Deleting directory and performing fresh clone.`);
                await rm(repoPath, { recursive: true, force: true });
            }
        }

        if (existsSync(repoPath) && !isReadOnly) {
            // @NOTE: in #483, we changed the cloning method s.t., we _no longer_
            // write the clone URL (which could contain a auth token) to the
            // `remote.origin.url` entry. For the upgrade scenario, we want
            // to unset this key since it is no longer needed, hence this line.
            // This will no-op if the key is already unset.
            // @see: https://github.com/sourcebot-dev/sourcebot/pull/483
            await unsetGitConfig({
                path: repoPath,
                keys: ["remote.origin.url"],
                signal,
            });

            logger.info(`Fetching ${repo.name} (id: ${repo.id})...`);
            const { durationMs } = await measure(() => fetchRepository({
                cloneUrl: cloneUrlMaybeWithToken,
                authHeader,
                path: repoPath,
                onProgress: ({ method, stage, progress }) => {
                    logger.debug(`git.${method} ${stage} stage ${progress}% complete for ${repo.name} (id: ${repo.id})`)
                },
                signal,
            }));
            const fetchDuration_s = durationMs / 1000;

            process.stdout.write('\n');
            logger.info(`Fetched ${repo.name} (id: ${repo.id}) in ${fetchDuration_s}s`);

        } else if (!isReadOnly) {
            logger.info(`Cloning ${repo.name} (id: ${repo.id})...`);

            const { durationMs } = await measure(() => cloneRepository({
                cloneUrl: cloneUrlMaybeWithToken,
                authHeader,
                path: repoPath,
                onProgress: ({ method, stage, progress }) => {
                    logger.debug(`git.${method} ${stage} stage ${progress}% complete for ${repo.name} (id: ${repo.id})`)
                },
                signal
            }));
            const cloneDuration_s = durationMs / 1000;

            process.stdout.write('\n');
            logger.info(`Cloned ${repo.name} (id: ${repo.id}) in ${cloneDuration_s}s`);
        }

        // Regardless of clone or fetch, always upsert the git config for the repo.
        // This ensures that the git config is always up to date for whatever we
        // have in the DB.
        if (metadata.gitConfig && !isReadOnly) {
            await upsertGitConfig({
                path: repoPath,
                gitConfig: metadata.gitConfig,
                signal,
            });
        }

        let revisions = [
            'HEAD'
        ];

        if (metadata.branches) {
            const branchGlobs = metadata.branches
            const allBranches = await getBranches(repoPath);
            const matchingBranches =
                allBranches
                    .filter((branch) => micromatch.isMatch(branch, branchGlobs))
                    .map((branch) => `refs/heads/${branch}`);

            revisions = [
                ...revisions,
                ...matchingBranches
            ];
        }

        if (metadata.tags) {
            const tagGlobs = metadata.tags;
            const allTags = await getTags(repoPath);
            const matchingTags =
                allTags
                    .filter((tag) => micromatch.isMatch(tag, tagGlobs))
                    .map((tag) => `refs/tags/${tag}`);

            revisions = [
                ...revisions,
                ...matchingTags
            ];
        }

        // zoekt has a limit of 64 branches/tags to index.
        if (revisions.length > 64) {
            logger.warn(`Too many revisions (${revisions.length}) for repo ${repo.id}, truncating to 64`);
            captureEvent('backend_revisions_truncated', {
                repoId: repo.id,
                revisionCount: revisions.length,
            });
            revisions = revisions.slice(0, 64);
        }

        logger.info(`Indexing ${repo.name} (id: ${repo.id})...`);
        const { durationMs } = await measure(() => indexGitRepository(repo, this.settings, revisions, signal));
        const indexDuration_s = durationMs / 1000;
        logger.info(`Indexed ${repo.name} (id: ${repo.id}) in ${indexDuration_s}s`);

        return revisions;
    }

    private async cleanupRepository(repo: Repo, logger: Logger) {
        const { path: repoPath, isReadOnly } = getRepoPath(repo);
        if (existsSync(repoPath) && !isReadOnly) {
            logger.info(`Deleting repo directory ${repoPath}`);
            await rm(repoPath, { recursive: true, force: true });
        }

        const shardPrefix = getShardPrefix(repo.orgId, repo.id);
        const files = (await readdir(INDEX_CACHE_DIR)).filter(file => file.startsWith(shardPrefix));
        for (const file of files) {
            const filePath = `${INDEX_CACHE_DIR}/${file}`;
            logger.info(`Deleting shard file ${filePath}`);
            await rm(filePath, { force: true });
        }
    }

    private onJobCompleted = async (job: Job<JobPayload>) =>
        groupmqLifecycleExceptionWrapper('onJobCompleted', logger, async () => {
            const logger = createJobLogger(job.data.jobId);
            const jobData = await this.db.repoIndexingJob.update({
                where: { id: job.data.jobId },
                data: {
                    status: RepoIndexingJobStatus.COMPLETED,
                    completedAt: new Date(),
                },
                include: {
                    repo: true,
                }
            });

            const jobTypeLabel = getJobTypePrometheusLabel(jobData.type);

            if (jobData.type === RepoIndexingJobType.INDEX) {
                const { path: repoPath } = getRepoPath(jobData.repo);
                const commitHash = await getCommitHashForRefName({
                    path: repoPath,
                    refName: 'HEAD',
                });

                const jobMetadata = repoIndexingJobMetadataSchema.parse(jobData.metadata);

                const repo = await this.db.repo.update({
                    where: { id: jobData.repoId },
                    data: {
                        indexedAt: new Date(),
                        indexedCommitHash: commitHash,
                        metadata: {
                            ...(jobData.repo.metadata as RepoMetadata),
                            indexedRevisions: jobMetadata.indexedRevisions,
                        } satisfies RepoMetadata,
                    }
                });

                logger.info(`Completed index job ${job.data.jobId} for repo ${repo.name} (id: ${repo.id})`);
            }
            else if (jobData.type === RepoIndexingJobType.CLEANUP) {
                const repo = await this.db.repo.delete({
                    where: { id: jobData.repoId },
                });

                logger.info(`Completed cleanup job ${job.data.jobId} for repo ${repo.name} (id: ${repo.id})`);
            }

            // Track metrics for successful job
            this.promClient.activeRepoIndexJobs.dec({ repo: job.data.repoName, type: jobTypeLabel });
            this.promClient.repoIndexJobSuccessTotal.inc({ repo: job.data.repoName, type: jobTypeLabel });
        });

    private onJobFailed = async (job: Job<JobPayload>) =>
        groupmqLifecycleExceptionWrapper('onJobFailed', logger, async () => {
            const logger = createJobLogger(job.data.jobId);

            const attempt = job.attemptsMade + 1;
            const wasLastAttempt = attempt >= job.opts.attempts;

            const jobTypeLabel = getJobTypePrometheusLabel(job.data.type);

            if (wasLastAttempt) {
                const { repo } = await this.db.repoIndexingJob.update({
                    where: { id: job.data.jobId },
                    data: {
                        status: RepoIndexingJobStatus.FAILED,
                        completedAt: new Date(),
                        errorMessage: job.failedReason,
                    },
                    select: { repo: true }
                });

                this.promClient.activeRepoIndexJobs.dec({ repo: job.data.repoName, type: jobTypeLabel });
                this.promClient.repoIndexJobFailTotal.inc({ repo: job.data.repoName, type: jobTypeLabel });

                logger.error(`Failed job ${job.data.jobId} for repo ${repo.name} (id: ${repo.id}). Attempt ${attempt} / ${job.opts.attempts}. Failing job.`);
            } else {
                const repo = await this.db.repo.findUniqueOrThrow({
                    where: { id: job.data.repoId },
                });

                this.promClient.repoIndexJobReattemptsTotal.inc({ repo: job.data.repoName, type: jobTypeLabel });

                logger.warn(`Failed job ${job.data.jobId} for repo ${repo.name} (id: ${repo.id}). Attempt ${attempt} / ${job.opts.attempts}. Retrying.`);
            }
        });

    private onJobStalled = async (jobId: string) =>
        groupmqLifecycleExceptionWrapper('onJobStalled', logger, async () => {
            const logger = createJobLogger(jobId);
            const { repo, type } = await this.db.repoIndexingJob.update({
                where: { id: jobId },
                data: {
                    status: RepoIndexingJobStatus.FAILED,
                    completedAt: new Date(),
                    errorMessage: 'Job stalled',
                },
                select: { repo: true, type: true }
            });

            const jobTypeLabel = getJobTypePrometheusLabel(type);
            this.promClient.activeRepoIndexJobs.dec({ repo: repo.name, type: jobTypeLabel });
            this.promClient.repoIndexJobFailTotal.inc({ repo: repo.name, type: jobTypeLabel });

            logger.error(`Job ${jobId} stalled for repo ${repo.name} (id: ${repo.id})`);
        });

    private onJobGracefulTimeout = async (job: Job<JobPayload>) =>
        groupmqLifecycleExceptionWrapper('onJobGracefulTimeout', logger, async () => {
            const logger = createJobLogger(job.data.jobId);
            const jobTypeLabel = getJobTypePrometheusLabel(job.data.type);

            const { repo } = await this.db.repoIndexingJob.update({
                where: { id: job.data.jobId },
                data: {
                    status: RepoIndexingJobStatus.FAILED,
                    completedAt: new Date(),
                    errorMessage: 'Job timed out',
                },
                select: { repo: true }
            });

            this.promClient.activeRepoIndexJobs.dec({ repo: job.data.repoName, type: jobTypeLabel });
            this.promClient.repoIndexJobFailTotal.inc({ repo: job.data.repoName, type: jobTypeLabel });

            logger.error(`Job ${job.data.jobId} timed out for repo ${repo.name} (id: ${repo.id}). Failing job.`);

        });

    private async onWorkerError(error: Error) {
        Sentry.captureException(error);
        logger.error(`Index syncer worker error.`, error);
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
            const lockKey = `groupmq:repo-index-queue:lock:${job.groupId}`;
            logger.debug(`Releasing group lock ${lockKey} for in progress job ${job.id}`);
            await this.redis.del(lockKey);
        }

        // @note: As of groupmq v1.0.0, queue.close() will just close the underlying
        // redis connection. Since we share the same redis client between 
        // @see: https://github.com/Openpanel-dev/groupmq/blob/main/src/queue.ts#L1900
        // await this.queue.close();
    }
}

const getJobTypePrometheusLabel = (type: RepoIndexingJobType) => type === RepoIndexingJobType.INDEX ? 'index' : 'cleanup';