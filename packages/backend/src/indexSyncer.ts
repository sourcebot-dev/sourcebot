import { createBullBoard } from '@bull-board/api';
import { ExpressAdapter } from '@bull-board/express';
import * as Sentry from '@sentry/node';
import { PrismaClient, Repo, RepoIndexingJobStatus } from "@sourcebot/db";
import { createLogger } from "@sourcebot/logger";
import express from 'express';
import { BullBoardGroupMQAdapter, Queue, Worker } from "groupmq";
import { Redis } from 'ioredis';
import { Settings } from "./types.js";

const logger = createLogger('index-syncer');

type IndexSyncJob = {
    jobId: string;
}

const JOB_TIMEOUT_MS = 1000 * 60; // 60 second timeout.

export class IndexSyncer {
    private interval?: NodeJS.Timeout;
    private queue: Queue<IndexSyncJob>;
    private worker: Worker<IndexSyncJob>;

    constructor(
        private db: PrismaClient,
        private settings: Settings,
        redis: Redis,
    ) {
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
            handler: async (job) => {
                const id = job.data.jobId;
                const { repo } = await this.db.repoIndexingJob.update({
                    where: {
                        id,
                    },
                    data: {
                        status: RepoIndexingJobStatus.IN_PROGRESS,
                    },
                    select: {
                        repo: true,
                    }
                });

                logger.info(`Running index job ${id} for repo ${repo.name}`);

                await new Promise(resolve => setTimeout(resolve, 1000 * 10));

                return true;
            },
            concurrency: 4,
        });

        this.worker.on('completed', async (job) => {
            const { repo } = await this.db.repoIndexingJob.update({
                where: {
                    id: job.data.jobId,
                },
                data: {
                    status: RepoIndexingJobStatus.COMPLETED,
                    repo: {
                        update: {
                            indexedAt: new Date(),
                        }
                    },
                    completedAt: new Date(),
                },
                select: {
                    repo: true,
                }
            });

            logger.info(`Completed index job ${job.data.jobId} for repo ${repo.name}`);
        });

        this.worker.on('failed', async (job) => {
            const { repo } = await this.db.repoIndexingJob.update({
                where: {
                    id: job.data.jobId,
                },
                data: {
                    status: RepoIndexingJobStatus.FAILED,
                    completedAt: new Date(),
                    errorMessage: job.failedReason,
                },
                select: {
                    repo: true,
                }
            });

            logger.error(`Failed index job ${job.data.jobId} for repo ${repo.name}`);
        });

        this.worker.on('stalled', async (jobId) => {
            const { repo } = await this.db.repoIndexingJob.update({
                where: { id: jobId },
                data: {
                    status: RepoIndexingJobStatus.FAILED,
                    completedAt: new Date(),
                    errorMessage: 'Job stalled',
                },
                select: { repo: true }
            });

            logger.warn(`Job ${jobId} stalled for repo ${repo.name}`);
        });

        this.worker.on('error', async (error) => {
            Sentry.captureException(error);
            logger.error(`Index syncer worker error.`, error);
        });

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

    public dispose() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.worker.close();
        this.queue.close();
    }
}