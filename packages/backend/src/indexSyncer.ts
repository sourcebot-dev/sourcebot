import { createBullBoard } from '@bull-board/api';
import { ExpressAdapter } from '@bull-board/express';
import * as Sentry from '@sentry/node';
import { Prisma, PrismaClient, Repo, RepoIndexingJobStatus } from "@sourcebot/db";
import { createLogger, Logger, Transport, TransportStreamOptions } from "@sourcebot/logger";
import express from 'express';
import { BullBoardGroupMQAdapter, Job, Queue, ReservedJob, Worker } from "groupmq";
import { Redis } from 'ioredis';
import { AppContext, repoMetadataSchema, RepoWithConnections, Settings } from "./types.js";
import { getAuthCredentialsForRepo, getRepoPath, measure } from './utils.js';
import { existsSync } from 'fs';
import { cloneRepository, fetchRepository, unsetGitConfig, upsertGitConfig } from './git.js';
import { indexGitRepository } from './zoekt.js';

interface LogEntry {
    message: string;
}

interface DatabaseTransportOptions extends TransportStreamOptions {
    writer: (logs: LogEntry[]) => Promise<void>;
}

export class DatabaseTransport extends Transport {
    private logs: LogEntry[] = [];
    private writer: (logs: LogEntry[]) => Promise<void>;

    constructor(opts: DatabaseTransportOptions) {
        super(opts);
        this.writer = opts.writer;
    }

    log(info: any, callback: () => void) {
        setImmediate(() => {
            this.emit('logged', info);
        });

        // Capture structured log data
        const logEntry: LogEntry = {
            // timestamp: info.timestamp,
            // level: info.level,
            message: info.message,
            // label: info.label,
            // stack: info.stack,
            // metadata: info.metadata || {},
            // ...info // Include any additional fields
        };

        this.logs.push(logEntry);

        callback();
    }

    async flush() {
        if (this.logs.length > 0) {
            await this.writer(this.logs);
            this.logs = [];
        }
    }
}


const useScopedLogger = async (jobId: string, db: PrismaClient, cb: (logger: Logger) => Promise<void>) => {
    const transport = new DatabaseTransport({
        writer: async (logs) => {
            try {
                const existingLogs = await db.repoIndexingJob.findUnique({
                    where: { id: jobId },
                    select: { logs: true }
                });

                await db.repoIndexingJob.update({
                    where: { id: jobId },
                    data: {
                        logs: [
                            ...(existingLogs?.logs as unknown as LogEntry[] ?? []),
                            ...logs,
                        ] as unknown as Prisma.InputJsonValue,
                    }
                })
            } catch (error) {
                console.error(`Error writing logs for job ${jobId}.`, error);
            }
        }
    });

    const logger = createLogger('index-syncer', [
        transport,
    ]);

    try {
        await cb(logger);
    } finally {
        await transport.flush();
    }
}

type IndexSyncJob = {
    jobId: string;
}

const JOB_TIMEOUT_MS = 1000 * 60 * 60 * 6; // 6 hour indexing timeout

export class IndexSyncer {
    private interval?: NodeJS.Timeout;
    private queue: Queue<IndexSyncJob>;
    private worker: Worker<IndexSyncJob>;
    private globalLogger: Logger;

    constructor(
        private db: PrismaClient,
        private settings: Settings,
        redis: Redis,
        private ctx: AppContext,
    ) {
        this.globalLogger = createLogger('index-syncer');
        this.queue = new Queue<IndexSyncJob>({
            redis,
            namespace: 'index-sync-queue',
            jobTimeoutMs: JOB_TIMEOUT_MS,
            // logger: true,
        });

        this.worker = new Worker<IndexSyncJob>({
            queue: this.queue,
            maxStalledCount: 1,
            stalledInterval: 1000,
            handler: this.runJob.bind(this),
            concurrency: this.settings.maxRepoIndexingJobConcurrency,
        });

        this.worker.on('completed', this.onJobCompleted.bind(this));
        this.worker.on('failed', this.onJobFailed.bind(this));
        this.worker.on('stalled', this.onJobStalled.bind(this));
        this.worker.on('error', async (error) => {
            Sentry.captureException(error);
            this.globalLogger.error(`Index syncer worker error.`, error);
        });

        // @nocheckin
        const app = express();
        const serverAdapter = new ExpressAdapter();

        createBullBoard({
            queues: [new BullBoardGroupMQAdapter(this.queue, { displayName: 'Index Sync' })],
            serverAdapter,
        });

        app.use('/', serverAdapter.getRouter());
        app.listen(3070);
    }

    public async startScheduler() {
        this.interval = setInterval(async () => {
            const thresholdDate = new Date(Date.now() - this.settings.reindexIntervalMs);

            const repos = await this.db.repo.findMany({
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
                                indexingJobs: {
                                    some: {
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
                                                            gt: thresholdDate,
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
                                }
                            }
                        }
                    ],
                }
            });

            if (repos.length === 0) {
                return;
            }

            await this.scheduleIndexSync(repos);
        }, 1000 * 5);

        this.worker.run();
    }

    private async scheduleIndexSync(repos: Repo[]) {
        // @note: we don't perform this in a transaction because
        // we want to avoid the situation where a job is created and run
        // prior to the transaction being committed.
        const jobs = await this.db.repoIndexingJob.createManyAndReturn({
            data: repos.map(repo => ({
                repoId: repo.id,
            }))
        });

        for (const job of jobs) {
            await this.queue.add({
                groupId: `repo:${job.repoId}`,
                data: {
                    jobId: job.id,
                },
                jobId: job.id,
            });
        }
    }

    private runJob = async (job: ReservedJob<IndexSyncJob>) =>
        useScopedLogger(job.data.jobId, this.db, async (logger) => {
            const id = job.data.jobId;

            const { repo } = await this.db.repoIndexingJob.update({
                where: {
                    id,
                },
                data: {
                    status: RepoIndexingJobStatus.IN_PROGRESS,
                },
                select: {
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

            await this._syncGitRepository(repo, logger);
        })

    private onJobCompleted = async (job: Job<IndexSyncJob>) =>
        useScopedLogger(job.data.jobId, this.db, async (logger) => {
            const { repo } = await this.db.repoIndexingJob.update({
                where: { id: job.data.jobId },
                data: {
                    status: RepoIndexingJobStatus.COMPLETED,
                    repo: {
                        update: {
                            indexedAt: new Date(),
                        }
                    },
                    completedAt: new Date(),
                },
                select: { repo: true }
            });

            logger.info(`Completed index job ${job.data.jobId} for repo ${repo.name}`);
        })

    private onJobFailed = (job: Job<IndexSyncJob>) =>
        useScopedLogger(job.data.jobId, this.db, async (logger) => {
            const { repo } = await this.db.repoIndexingJob.update({
                where: { id: job.data.jobId },
                data: {
                    status: RepoIndexingJobStatus.FAILED,
                    completedAt: new Date(),
                    errorMessage: job.failedReason,
                },
                select: { repo: true }
            });

            logger.error(`Failed index job ${job.data.jobId} for repo ${repo.name}`);
        })

    private onJobStalled = (jobId: string) =>
        useScopedLogger(jobId, this.db, async (logger) => {
            const { repo } = await this.db.repoIndexingJob.update({
                where: { id: jobId },
                data: {
                    status: RepoIndexingJobStatus.FAILED,
                    completedAt: new Date(),
                    errorMessage: 'Job stalled',
                },
                select: { repo: true }
            });

            logger.error(`Job ${jobId} stalled for repo ${repo.name}`);
        })


    private _syncGitRepository = async (repo: RepoWithConnections, logger: Logger) => {
        const { path: repoPath, isReadOnly } = getRepoPath(repo, this.ctx);

        const metadata = repoMetadataSchema.parse(repo.metadata);

        const credentials = await getAuthCredentialsForRepo(repo, this.db);
        const cloneUrlMaybeWithToken = credentials?.cloneUrlWithToken ?? repo.cloneUrl;
        const authHeader = credentials?.authHeader ?? undefined;

        if (existsSync(repoPath) && !isReadOnly) {
            // @NOTE: in #483, we changed the cloning method s.t., we _no longer_
            // write the clone URL (which could contain a auth token) to the
            // `remote.origin.url` entry. For the upgrade scenario, we want
            // to unset this key since it is no longer needed, hence this line.
            // This will no-op if the key is already unset.
            // @see: https://github.com/sourcebot-dev/sourcebot/pull/483
            await unsetGitConfig(repoPath, ["remote.origin.url"]);

            logger.info(`Fetching ${repo.displayName}...`);
            const { durationMs } = await measure(() => fetchRepository({
                cloneUrl: cloneUrlMaybeWithToken,
                authHeader,
                path: repoPath,
                onProgress: ({ method, stage, progress }) => {
                    logger.debug(`git.${method} ${stage} stage ${progress}% complete for ${repo.displayName}`)
                }
            }));
            const fetchDuration_s = durationMs / 1000;

            process.stdout.write('\n');
            logger.info(`Fetched ${repo.displayName} in ${fetchDuration_s}s`);

        } else if (!isReadOnly) {
            logger.info(`Cloning ${repo.displayName}...`);

            const { durationMs } = await measure(() => cloneRepository({
                cloneUrl: cloneUrlMaybeWithToken,
                authHeader,
                path: repoPath,
                onProgress: ({ method, stage, progress }) => {
                    logger.debug(`git.${method} ${stage} stage ${progress}% complete for ${repo.displayName}`)
                }
            }));
            const cloneDuration_s = durationMs / 1000;

            process.stdout.write('\n');
            logger.info(`Cloned ${repo.displayName} in ${cloneDuration_s}s`);
        }

        // Regardless of clone or fetch, always upsert the git config for the repo.
        // This ensures that the git config is always up to date for whatever we
        // have in the DB.
        if (metadata.gitConfig && !isReadOnly) {
            await upsertGitConfig(repoPath, metadata.gitConfig);
        }

        logger.info(`Indexing ${repo.displayName}...`);
        const { durationMs } = await measure(() => indexGitRepository(repo, this.settings, this.ctx));
        const indexDuration_s = durationMs / 1000;
        logger.info(`Indexed ${repo.displayName} in ${indexDuration_s}s`);
    }


    public dispose() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.worker.close();
        this.queue.close();
    }
}
