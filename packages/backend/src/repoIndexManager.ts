import * as Sentry from '@sentry/node';
import { PrismaClient, Repo, RepoIndexingJobStatus, RepoIndexingJobType } from "@sourcebot/db";
import { createLogger, env, getRepoPath, Logger, RepoIndexingJobMetadata, repoIndexingJobMetadataSchema, RepoMetadata, repoMetadataSchema } from "@sourcebot/shared";
import { DelayedError, Job, Queue, Worker } from "bullmq";
import { existsSync } from 'fs';
import { readdir, rm } from 'fs/promises';
import { Redis } from 'ioredis';
import micromatch from 'micromatch';
import Redlock, { ExecutionError } from 'redlock';
import { INDEX_CACHE_DIR, WORKER_STOP_GRACEFUL_TIMEOUT_MS } from './constants.js';
import { cloneRepository, fetchRepository, getBranches, getCommitHashForRefName, getLatestCommitTimestamp, getLocalDefaultBranch, getTags, isPathAValidGitRepoRoot, isRepoEmpty, unsetGitConfig, upsertGitConfig } from './git.js';
import { captureEvent } from './posthog.js';
import { PromClient } from './promClient.js';
import { RepoWithConnections, Settings } from "./types.js";
import { getAuthCredentialsForRepo, getShardPrefix, measure, setIntervalAsync } from './utils.js';
import { cleanupTempShards, indexGitRepository } from './zoekt.js';

const LOG_TAG = 'repo-index-manager';
const logger = createLogger(LOG_TAG);
const createJobLogger = (jobId: string) => createLogger(`${LOG_TAG}:job:${jobId}`);
const QUEUE_NAME = 'repo-index-queue';

type JobPayload = {
    type: 'INDEX' | 'CLEANUP';
    jobId: string;
    repoId: number;
    repoName: string;
};

// Lock TTL with auto-extension - minimizes dead lock time after crashes
const LOCK_TTL_MS = 60 * 1000; // 1 minute
const LOCK_PREFIX = `bullmq:${QUEUE_NAME}:lock:`;

// Delay before retrying a job when the group lock cannot be acquired
const LOCK_RETRY_DELAY_MS = 5000;

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
    private redlock: Redlock;
    private abortController: AbortController;

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

        this.redlock = new Redlock([redis], {
            retryCount: 0, // Don't retry - we'll delay the job instead
            automaticExtensionThreshold: LOCK_TTL_MS / 2, // Extend when 50% of TTL remains
        });

        this.worker = new Worker<JobPayload>(
            QUEUE_NAME,
            this.processJob.bind(this),
            {
                connection: redis,
                concurrency: this.settings.maxRepoIndexingJobConcurrency,
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
            logger.error(`Index syncer worker error:`, error);
        });
    }

    public startScheduler() {
        logger.debug('Starting scheduler');
        this.interval = setIntervalAsync(async () => {
            await this.scheduleIndexJobs();
            await this.scheduleCleanupJobs();
        }, this.settings.reindexRepoPollingIntervalMs);
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
                isAutoCleanupDisabled: false,
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
            await this.queue.add(
                'repo-index-job',
                {
                    jobId: job.id,
                    type,
                    repoName: job.repo.name,
                    repoId: job.repo.id,
                },
                { jobId: job.id }
            );

            const jobTypeLabel = getJobTypePrometheusLabel(type);
            this.promClient.pendingRepoIndexJobs.inc({ repo: job.repo.name, type: jobTypeLabel });
        }

        return jobs.map(job => job.id);
    }

    private async processJob(job: Job<JobPayload>): Promise<void> {
        const groupId = `repo:${job.data.repoId}`;
        const lockKey = `${LOCK_PREFIX}${groupId}`;

        try {
            return await this.redlock.using([lockKey], LOCK_TTL_MS, async (lockSignal: AbortSignal) => {
                const signal = AbortSignal.any([
                    this.abortController.signal,
                    lockSignal,
                ]);

                return await this.runJob(job, signal);
            });
        } catch (error) {
            if (error instanceof ExecutionError) {
                // Lock could not be acquired - another job for this group is running
                // Delay this job and let BullMQ retry later
                // DelayedError tells BullMQ to delay without counting as a failed attempt
                logger.debug(`Group ${groupId} locked, delaying job ${job.id}`);
                await job.moveToDelayed(Date.now() + LOCK_RETRY_DELAY_MS, job.token);
                throw new DelayedError(`Group ${groupId} locked, delaying job`);
            }
            throw error;
        }
    }

    private async runJob(job: Job<JobPayload>, signal: AbortSignal) {
        const id = job.data.jobId;
        const logger = createJobLogger(id);
        logger.info(`Running ${job.data.type} job ${id} for repo ${job.data.repoName} (id: ${job.data.repoId})`);

        const currentStatus = await this.db.repoIndexingJob.findUniqueOrThrow({
            where: {
                id,
            },
            select: {
                status: true,
            }
        });

        // Fail safe: if the job is not PENDING (first run) or IN_PROGRESS (retry), it indicates the job
        // is in an invalid state and should be skipped.
        if (
            currentStatus.status !== RepoIndexingJobStatus.PENDING &&
            currentStatus.status !== RepoIndexingJobStatus.IN_PROGRESS
        ) {
            throw new Error(`Job ${id} is not in a valid state. Expected: ${RepoIndexingJobStatus.PENDING} or ${RepoIndexingJobStatus.IN_PROGRESS}. Actual: ${currentStatus.status}. Skipping.`);
        }

        const { repo, type: jobType } = await this.db.repoIndexingJob.update({
            where: {
                id,
            },
            data: {
                status: RepoIndexingJobStatus.IN_PROGRESS,
                repo: {
                    update: {
                        latestIndexingJobStatus: RepoIndexingJobStatus.IN_PROGRESS,
                    }
                }
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

        if (jobType === RepoIndexingJobType.INDEX) {
            const revisions = await this.indexRepository(repo, logger, signal);

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

        const defaultBranch = await getLocalDefaultBranch({
            path: repoPath,
        });

        // Ensure defaultBranch has refs/heads/ prefix for consistent searching
        const defaultBranchWithPrefix = defaultBranch && !defaultBranch.startsWith('refs/')
            ? `refs/heads/${defaultBranch}`
            : defaultBranch;

        let revisions = defaultBranchWithPrefix ? [defaultBranchWithPrefix] : ['HEAD'];

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

        // De-duplicate revisions to ensure we don't have duplicate branches/tags
        revisions = [...new Set(revisions)];

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
        try {
            const { durationMs } = await measure(() => indexGitRepository(repo, this.settings, revisions, signal));
            const indexDuration_s = durationMs / 1000;
            logger.info(`Indexed ${repo.name} (id: ${repo.id}) in ${indexDuration_s}s`);
        } catch (error) {
            // Clean up any temporary shard files left behind by the failed indexing operation.
            // Zoekt creates .tmp files during indexing which can accumulate if indexing fails repeatedly.
            logger.warn(`Indexing failed for ${repo.name} (id: ${repo.id}), cleaning up temp shard files...`);
            await cleanupTempShards(repo);
            throw error;
        }

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

    private async onJobCompleted(job: Job<JobPayload>) {
        try {
            const logger = createJobLogger(job.data.jobId);
            const jobData = await this.db.repoIndexingJob.update({
                where: { id: job.data.jobId },
                data: {
                    status: RepoIndexingJobStatus.COMPLETED,
                    completedAt: new Date(),
                    repo: {
                        update: {
                            latestIndexingJobStatus: RepoIndexingJobStatus.COMPLETED,
                        }
                    }
                },
                include: {
                    repo: true,
                }
            });

            const jobTypeLabel = getJobTypePrometheusLabel(jobData.type);

            if (jobData.type === RepoIndexingJobType.INDEX) {
                const { path: repoPath } = getRepoPath(jobData.repo);
                const isEmpty = await isRepoEmpty({ path: repoPath });
                const commitHash = isEmpty ? undefined : await getCommitHashForRefName({
                    path: repoPath,
                    refName: 'HEAD',
                });

                const pushedAt = await getLatestCommitTimestamp({ path: repoPath });
                const defaultBranch = await getLocalDefaultBranch({ path: repoPath });

                const jobMetadata = repoIndexingJobMetadataSchema.parse(jobData.metadata);

                const repo = await this.db.repo.update({
                    where: { id: jobData.repoId },
                    data: {
                        indexedAt: new Date(),
                        indexedCommitHash: commitHash,
                        pushedAt: pushedAt,
                        metadata: {
                            ...(jobData.repo.metadata as RepoMetadata),
                            indexedRevisions: jobMetadata.indexedRevisions,
                        } satisfies RepoMetadata,
                        // @note: always update the default branch. While this field can be set
                        // during connection syncing, by setting it here we ensure that a) the
                        // default branch is as up to date as possible (since repo indexing happens
                        // more frequently than connection syncing) and b) for hosts where it is
                        // impossible to determine the default branch from the host's API
                        // (e.g., generic git url), we still set the default branch here.
                        defaultBranch: defaultBranch,
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

            if (jobData.type === RepoIndexingJobType.INDEX && jobData.repo.indexedAt === null) {
                captureEvent('backend_repo_first_indexed', {
                    repoId: job.data.repoId,
                    type: jobData.repo.external_codeHostType,
                });
            }
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

            const jobLogger = createJobLogger(job.data.jobId);
            const jobTypeLabel = getJobTypePrometheusLabel(job.data.type);

            // @note: we need to check the job state to determine if the job failed,
            // or if it is being retried.
            const jobState = await job.getState();
            if (jobState !== 'failed') {
                jobLogger.warn(`Job ${job.id} for repo ${job.data.repoName} (id: ${job.data.repoId}) failed. Retrying...`);
                return;
            }

            const { repo } = await this.db.repoIndexingJob.update({
                where: { id: job.data.jobId },
                data: {
                    status: RepoIndexingJobStatus.FAILED,
                    completedAt: new Date(),
                    errorMessage: error.message,
                    repo: {
                        update: {
                            latestIndexingJobStatus: RepoIndexingJobStatus.FAILED,
                        }
                    }
                },
                select: { repo: true }
            });

            this.promClient.activeRepoIndexJobs.dec({ repo: job.data.repoName, type: jobTypeLabel });
            this.promClient.repoIndexJobFailTotal.inc({ repo: job.data.repoName, type: jobTypeLabel });

            jobLogger.error(`Failed job ${job.data.jobId} for repo ${repo.name} (id: ${repo.id}).`);

            captureEvent('backend_repo_index_job_failed', {
                repoId: job.data.repoId,
                jobType: job.data.type,
                type: repo.external_codeHostType,
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

        // Locks will auto-expire via TTL, no need to manually release them
        await this.queue.close();
    }
}

const getJobTypePrometheusLabel = (type: RepoIndexingJobType) => type === RepoIndexingJobType.INDEX ? 'index' : 'cleanup';
