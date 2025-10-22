import * as Sentry from "@sentry/node";
import { PrismaClient, User, UserPermissionSyncJobStatus } from "@sourcebot/db";
import { createLogger } from "@sourcebot/logger";
import { Job, Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { PERMISSION_SYNC_SUPPORTED_CODE_HOST_TYPES } from "../constants.js";
import { env } from "../env.js";
import { createOctokitFromToken, getReposForAuthenticatedUser } from "../github.js";
import { hasEntitlement } from "@sourcebot/shared";
import { Settings } from "../types.js";

const logger = createLogger('user-permission-syncer');

const QUEUE_NAME = 'userPermissionSyncQueue';

type UserPermissionSyncJob = {
    jobId: string;
}


export class UserPermissionSyncer {
    private queue: Queue<UserPermissionSyncJob>;
    private worker: Worker<UserPermissionSyncJob>;
    private interval?: NodeJS.Timeout;

    constructor(
        private db: PrismaClient,
        private settings: Settings,
        redis: Redis,
    ) {
        this.queue = new Queue<UserPermissionSyncJob>(QUEUE_NAME, {
            connection: redis,
        });
        this.worker = new Worker<UserPermissionSyncJob>(QUEUE_NAME, this.runJob.bind(this), {
            connection: redis,
            concurrency: 1,
        });
        this.worker.on('completed', this.onJobCompleted.bind(this));
        this.worker.on('failed', this.onJobFailed.bind(this));
    }

    public startScheduler() {
        if (!hasEntitlement('permission-syncing')) {
            throw new Error('Permission syncing is not supported in current plan.');
        }

        logger.debug('Starting scheduler');

        this.interval = setInterval(async () => {
            const thresholdDate = new Date(Date.now() - this.settings.experiment_userDrivenPermissionSyncIntervalMs);

            const users = await this.db.user.findMany({
                where: {
                    AND: [
                        {
                            accounts: {
                                some: {
                                    provider: {
                                        in: PERMISSION_SYNC_SUPPORTED_CODE_HOST_TYPES
                                    }
                                }
                            }
                        },
                        {
                            OR: [
                                { permissionSyncedAt: null },
                                { permissionSyncedAt: { lt: thresholdDate } },
                            ]
                        },
                        {
                            NOT: {
                                permissionSyncJobs: {
                                    some: {
                                        OR: [
                                            // Don't schedule if there are active jobs
                                            {
                                                status: {
                                                    in: [
                                                        UserPermissionSyncJobStatus.PENDING,
                                                        UserPermissionSyncJobStatus.IN_PROGRESS,
                                                    ],
                                                }
                                            },
                                            // Don't schedule if there are recent failed jobs (within the threshold date). Note `gt` is used here since this is a inverse condition.
                                            {
                                                AND: [
                                                    { status: UserPermissionSyncJobStatus.FAILED },
                                                    { completedAt: { gt: thresholdDate } },
                                                ]
                                            }
                                        ]
                                    }
                                }
                            }
                        },
                    ]
                }
            });

            await this.schedulePermissionSync(users);
        }, 1000 * 5);
    }

    public async dispose() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        await this.worker.close();
        await this.queue.close();
    }

    private async schedulePermissionSync(users: User[]) {
        await this.db.$transaction(async (tx) => {
            const jobs = await tx.userPermissionSyncJob.createManyAndReturn({
                data: users.map(user => ({
                    userId: user.id,
                })),
            });

            await this.queue.addBulk(jobs.map((job) => ({
                name: 'userPermissionSyncJob',
                data: {
                    jobId: job.id,
                },
                opts: {
                    removeOnComplete: env.REDIS_REMOVE_ON_COMPLETE,
                    removeOnFail: env.REDIS_REMOVE_ON_FAIL,
                }
            })))
        });
    }

    private async runJob(job: Job<UserPermissionSyncJob>) {
        const id = job.data.jobId;
        const { user } = await this.db.userPermissionSyncJob.update({
            where: {
                id,
            },
            data: {
                status: UserPermissionSyncJobStatus.IN_PROGRESS,
            },
            select: {
                user: {
                    include: {
                        accounts: true,
                    }
                }
            }
        });

        if (!user) {
            throw new Error(`User ${id} not found`);
        }

        logger.info(`Syncing permissions for user ${user.email}...`);

        // Get a list of all repos that the user has access to from all connected accounts.
        const repoIds = await (async () => {
            const aggregatedRepoIds: Set<number> = new Set();

            for (const account of user.accounts) {
                if (account.provider === 'github') {
                    if (!account.access_token) {
                        throw new Error(`User '${user.email}' does not have an GitHub OAuth access token associated with their GitHub account.`);
                    }

                    const { octokit } = await createOctokitFromToken({
                        token: account.access_token,
                        url: env.AUTH_EE_GITHUB_BASE_URL,
                    });
                    // @note: we only care about the private repos since we don't need to build a mapping
                    // for public repos.
                    // @see: packages/web/src/prisma.ts
                    const githubRepos = await getReposForAuthenticatedUser(/* visibility = */ 'private', octokit);
                    const gitHubRepoIds = githubRepos.map(repo => repo.id.toString());

                    const repos = await this.db.repo.findMany({
                        where: {
                            external_codeHostType: 'github',
                            external_id: {
                                in: gitHubRepoIds,
                            }
                        }
                    });

                    repos.forEach(repo => aggregatedRepoIds.add(repo.id));
                }
            }

            return Array.from(aggregatedRepoIds);
        })();

        await this.db.$transaction([
            this.db.user.update({
                where: {
                    id: user.id,
                },
                data: {
                    accessibleRepos: {
                        deleteMany: {},
                    }
                }
            }),
            this.db.userToRepoPermission.createMany({
                data: repoIds.map(repoId => ({
                    userId: user.id,
                    repoId,
                })),
                skipDuplicates: true,
            })
        ]);
    }

    private async onJobCompleted(job: Job<UserPermissionSyncJob>) {
        const { user } = await this.db.userPermissionSyncJob.update({
            where: {
                id: job.data.jobId,
            },
            data: {
                status: UserPermissionSyncJobStatus.COMPLETED,
                user: {
                    update: {
                        permissionSyncedAt: new Date(),
                    }
                },
                completedAt: new Date(),
            },
            select: {
                user: true
            }
        });

        logger.info(`Permissions synced for user ${user.email}`);
    }

    private async onJobFailed(job: Job<UserPermissionSyncJob> | undefined, err: Error) {
        Sentry.captureException(err, {
            tags: {
                jobId: job?.data.jobId,
                queue: QUEUE_NAME,
            }
        });

        const errorMessage = (email: string) => `User permission sync job failed for user ${email}: ${err.message}`;

        if (job) {
            const { user } = await this.db.userPermissionSyncJob.update({
                where: {
                    id: job.data.jobId,
                },
                data: {
                    status: UserPermissionSyncJobStatus.FAILED,
                    completedAt: new Date(),
                    errorMessage: err.message,
                },
                select: {
                    user: true,
                }
            });

            logger.error(errorMessage(user.email ?? user.id));
        } else {
            logger.error(errorMessage('unknown user (id not found)'));
        }
    }
}