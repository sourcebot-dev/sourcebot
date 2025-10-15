import * as Sentry from '@sentry/node';
import { PrismaClient, Repo, RepoJobStatus, RepoJobType } from "@sourcebot/db";
import { createLogger, Logger } from "@sourcebot/logger";
import { existsSync } from 'fs';
import { readdir, rm } from 'fs/promises';
import { Job, Queue, ReservedJob, Worker } from "groupmq";
import { Redis } from 'ioredis';
import { env } from './env.js';
import { cloneRepository, fetchRepository, isPathAValidGitRepoRoot, unsetGitConfig, upsertGitConfig } from './git.js';
import { AppContext, repoMetadataSchema, RepoWithConnections, Settings } from "./types.js";
import { getAuthCredentialsForRepo, getRepoPath, getShardPrefix, groupmqLifecycleExceptionWrapper, measure } from './utils.js';
import { indexGitRepository } from './zoekt.js';

const LOG_TAG = 'index-syncer';
const logger = createLogger(LOG_TAG);
const createJobLogger = (jobId: string) => createLogger(`${LOG_TAG}:job:${jobId}`);

type JobPayload = {
    type: 'INDEX' | 'CLEANUP';
    jobId: string;
    repoId: number;
    repoName: string;
};

const JOB_TIMEOUT_MS = 1000 * 60 * 60 * 6; // 6 hour indexing timeout

export class IndexSyncer {
    private interval?: NodeJS.Timeout;
    private queue: Queue<JobPayload>;
    private worker: Worker<JobPayload>;

    constructor(
        private db: PrismaClient,
        private settings: Settings,
        redis: Redis,
        private ctx: AppContext,
    ) {
        this.queue = new Queue<JobPayload>({
            redis,
            namespace: 'index-sync-queue',
            jobTimeoutMs: JOB_TIMEOUT_MS,
            maxAttempts: 3,
            ...(env.SOURCEBOT_LOG_LEVEL === 'debug' ? {
                logger,
            }: {}),
        });

        this.worker = new Worker<JobPayload>({
            queue: this.queue,
            maxStalledCount: 1,
            handler: this.runJob.bind(this),
            concurrency: this.settings.maxRepoIndexingJobConcurrency,
            ...(env.SOURCEBOT_LOG_LEVEL === 'debug' ? {
                logger,
            }: {}),
        });

        this.worker.on('completed', this.onJobCompleted.bind(this));
        this.worker.on('failed', this.onJobFailed.bind(this));
        this.worker.on('stalled', this.onJobStalled.bind(this));
        this.worker.on('error', this.onWorkerError.bind(this));
    }

    public async startScheduler() {
        this.interval = setInterval(async () => {
            await this.scheduleIndexJobs();
            await this.scheduleCleanupJobs();
        }, 1000 * 5);

        this.worker.run();
    }

    private async scheduleIndexJobs() {
        const thresholdDate = new Date(Date.now() - this.settings.reindexIntervalMs);
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
                                            type: RepoJobType.INDEX,
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
                                                                    RepoJobStatus.PENDING,
                                                                    RepoJobStatus.IN_PROGRESS,
                                                                ]
                                                            },
                                                        },
                                                        {
                                                            createdAt: {
                                                                gt: thresholdDate,
                                                            }
                                                        }
                                                    ]
                                                },
                                                // Don't schedule if there are recent failed jobs (within the threshold date).
                                                {
                                                    AND: [
                                                        { status: RepoJobStatus.FAILED },
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
            }
        });

        if (reposToIndex.length > 0) {
            await this.createJobs(reposToIndex, RepoJobType.INDEX);
        }
    }

    private async scheduleCleanupJobs() {
        const thresholdDate = new Date(Date.now() - this.settings.repoGarbageCollectionGracePeriodMs);

        const reposToCleanup = await this.db.repo.findMany({
            where: {
                connections: {
                    none: {}
                },
                OR: [
                    { indexedAt: null },
                    { indexedAt: { lt: thresholdDate } },
                ],
                // Don't schedule if there are active jobs that were created within the threshold date.
                NOT: {
                    jobs: {
                        some: {
                            AND: [
                                {
                                    type: RepoJobType.CLEANUP,
                                },
                                {
                                    status: {
                                        in: [
                                            RepoJobStatus.PENDING,
                                            RepoJobStatus.IN_PROGRESS,
                                        ]
                                    },
                                },
                                {
                                    createdAt: {
                                        gt: thresholdDate,
                                    }
                                }
                            ]
                        }
                    }
                }
            }
        });

        if (reposToCleanup.length > 0) {
            await this.createJobs(reposToCleanup, RepoJobType.CLEANUP);
        }
    }

    private async createJobs(repos: Repo[], type: RepoJobType) {
        // @note: we don't perform this in a transaction because
        // we want to avoid the situation where a job is created and run
        // prior to the transaction being committed.
        const jobs = await this.db.repoJob.createManyAndReturn({
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
                groupId: `repo:${job.repoId}_${job.repo.name}`,
                data: {
                    jobId: job.id,
                    type,
                    repoName: job.repo.name,
                    repoId: job.repo.id,
                },
                jobId: job.id,
            });
        }
    }

    private async runJob(job: ReservedJob<JobPayload>) {
        const id = job.data.jobId;
        const logger = createJobLogger(id);
        logger.info(`Running ${job.data.type} job ${id} for repo ${job.data.repoName} (id: ${job.data.repoId}) (attempt ${job.attempts + 1} / ${job.maxAttempts})`);

        const { repo, type: jobType } = await this.db.repoJob.update({
            where: {
                id,
            },
            data: {
                status: RepoJobStatus.IN_PROGRESS,
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

        if (jobType === RepoJobType.INDEX) {
            await this.indexRepository(repo, logger);
        } else if (jobType === RepoJobType.CLEANUP) {
            await this.cleanupRepository(repo, logger);
        }
    }

    private async indexRepository(repo: RepoWithConnections, logger: Logger) {
        const { path: repoPath, isReadOnly } = getRepoPath(repo, this.ctx);

        const metadata = repoMetadataSchema.parse(repo.metadata);

        const credentials = await getAuthCredentialsForRepo(repo, this.db);
        const cloneUrlMaybeWithToken = credentials?.cloneUrlWithToken ?? repo.cloneUrl;
        const authHeader = credentials?.authHeader ?? undefined;

        // If the repo path exists but it is not a valid git repository root, this indicates
        // that the repository is in a bad state. To fix, we remove the directory and perform
        // a fresh clone.
        if (existsSync(repoPath) && !(await isPathAValidGitRepoRoot(repoPath)) && !isReadOnly) {
            logger.warn(`${repoPath} is not a valid git repository root. Deleting directory and performing fresh clone.`);
            await rm(repoPath, { recursive: true, force: true });
        }

        if (existsSync(repoPath) && !isReadOnly) {
            // @NOTE: in #483, we changed the cloning method s.t., we _no longer_
            // write the clone URL (which could contain a auth token) to the
            // `remote.origin.url` entry. For the upgrade scenario, we want
            // to unset this key since it is no longer needed, hence this line.
            // This will no-op if the key is already unset.
            // @see: https://github.com/sourcebot-dev/sourcebot/pull/483
            await unsetGitConfig(repoPath, ["remote.origin.url"]);

            logger.info(`Fetching ${repo.name} (id: ${repo.id})...`);
            const { durationMs } = await measure(() => fetchRepository({
                cloneUrl: cloneUrlMaybeWithToken,
                authHeader,
                path: repoPath,
                onProgress: ({ method, stage, progress }) => {
                    logger.debug(`git.${method} ${stage} stage ${progress}% complete for ${repo.name} (id: ${repo.id})`)
                }
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
                }
            }));
            const cloneDuration_s = durationMs / 1000;

            process.stdout.write('\n');
            logger.info(`Cloned ${repo.name} (id: ${repo.id}) in ${cloneDuration_s}s`);
        }

        // Regardless of clone or fetch, always upsert the git config for the repo.
        // This ensures that the git config is always up to date for whatever we
        // have in the DB.
        if (metadata.gitConfig && !isReadOnly) {
            await upsertGitConfig(repoPath, metadata.gitConfig);
        }

        logger.info(`Indexing ${repo.name} (id: ${repo.id})...`);
        const { durationMs } = await measure(() => indexGitRepository(repo, this.settings, this.ctx));
        const indexDuration_s = durationMs / 1000;
        logger.info(`Indexed ${repo.name} (id: ${repo.id}) in ${indexDuration_s}s`);
    }

    private async cleanupRepository(repo: Repo, logger: Logger) {
        const { path: repoPath, isReadOnly } = getRepoPath(repo, this.ctx);
        if (existsSync(repoPath) && !isReadOnly) {
            logger.info(`Deleting repo directory ${repoPath}`);
            await rm(repoPath, { recursive: true, force: true });
        }

        const shardPrefix = getShardPrefix(repo.orgId, repo.id);
        const files = (await readdir(this.ctx.indexPath)).filter(file => file.startsWith(shardPrefix));
        for (const file of files) {
            const filePath = `${this.ctx.indexPath}/${file}`;
            logger.info(`Deleting shard file ${filePath}`);
            await rm(filePath, { force: true });
        }
    }

    private onJobCompleted = async (job: Job<JobPayload>) =>
        groupmqLifecycleExceptionWrapper('onJobCompleted', logger, async () => {
            const logger = createJobLogger(job.data.jobId);
            const jobData = await this.db.repoJob.update({
                where: { id: job.data.jobId },
                data: {
                    status: RepoJobStatus.COMPLETED,
                    completedAt: new Date(),
                }
            });

            if (jobData.type === RepoJobType.INDEX) {
                const repo = await this.db.repo.update({
                    where: { id: jobData.repoId },
                    data: {
                        indexedAt: new Date(),
                    }
                });

                logger.info(`Completed index job ${job.data.jobId} for repo ${repo.name} (id: ${repo.id})`);
            }
            else if (jobData.type === RepoJobType.CLEANUP) {
                const repo = await this.db.repo.delete({
                    where: { id: jobData.repoId },
                });

                logger.info(`Completed cleanup job ${job.data.jobId} for repo ${repo.name} (id: ${repo.id})`);
            }
        });

    private onJobFailed = async (job: Job<JobPayload>) =>
        groupmqLifecycleExceptionWrapper('onJobFailed', logger, async () => {
            const logger = createJobLogger(job.data.jobId);

            const attempt = job.attemptsMade + 1;
            const wasLastAttempt = attempt >= job.opts.attempts;

            if (wasLastAttempt) {
                const { repo } = await this.db.repoJob.update({
                    where: { id: job.data.jobId },
                    data: {
                        status: RepoJobStatus.FAILED,
                        completedAt: new Date(),
                        errorMessage: job.failedReason,
                    },
                    select: { repo: true }
                });

                logger.error(`Failed job ${job.data.jobId} for repo ${repo.name} (id: ${repo.id}). Attempt ${attempt} / ${job.opts.attempts}. Failing job.`);
            } else {
                const repo = await this.db.repo.findUniqueOrThrow({
                    where: { id: job.data.repoId },
                });

                logger.warn(`Failed job ${job.data.jobId} for repo ${repo.name} (id: ${repo.id}). Attempt ${attempt} / ${job.opts.attempts}. Retrying.`);
            }
        });

    private onJobStalled = async (jobId: string) =>
        groupmqLifecycleExceptionWrapper('onJobStalled', logger, async () => {
            const logger = createJobLogger(jobId);
            const { repo } = await this.db.repoJob.update({
                where: { id: jobId },
                data: {
                    status: RepoJobStatus.FAILED,
                    completedAt: new Date(),
                    errorMessage: 'Job stalled',
                },
                select: { repo: true }
            });

            logger.error(`Job ${jobId} stalled for repo ${repo.name} (id: ${repo.id})`);
        });

    private async onWorkerError(error: Error) {
        Sentry.captureException(error);
        logger.error(`Index syncer worker error.`, error);
    }

    public async dispose() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        await this.worker.close();
        await this.queue.close();
    }
}