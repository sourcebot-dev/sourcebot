import * as Sentry from "@sentry/node";
import { PrismaClient, AccountPermissionSyncJobStatus, Account } from "@sourcebot/db";
import { createLogger } from "@sourcebot/logger";
import { Job, Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { PERMISSION_SYNC_SUPPORTED_CODE_HOST_TYPES } from "../constants.js";
import { env } from "../env.js";
import { createOctokitFromToken, getReposForAuthenticatedUser } from "../github.js";
import { createGitLabFromOAuthToken, getProjectsForAuthenticatedUser } from "../gitlab.js";
import { hasEntitlement } from "@sourcebot/shared";
import { Settings } from "../types.js";

const LOG_TAG = 'user-permission-syncer';
const logger = createLogger(LOG_TAG);
const createJobLogger = (jobId: string) => createLogger(`${LOG_TAG}:job:${jobId}`);

const QUEUE_NAME = 'accountPermissionSyncQueue';

type AccountPermissionSyncJob = {
    jobId: string;
}

export class AccountPermissionSyncer {
    private queue: Queue<AccountPermissionSyncJob>;
    private worker: Worker<AccountPermissionSyncJob>;
    private interval?: NodeJS.Timeout;

    constructor(
        private db: PrismaClient,
        private settings: Settings,
        redis: Redis,
    ) {
        this.queue = new Queue<AccountPermissionSyncJob>(QUEUE_NAME, {
            connection: redis,
        });
        this.worker = new Worker<AccountPermissionSyncJob>(QUEUE_NAME, this.runJob.bind(this), {
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

            const accounts = await this.db.account.findMany({
                where: {
                    AND: [
                        {
                            provider: {
                                in: PERMISSION_SYNC_SUPPORTED_CODE_HOST_TYPES
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
                                                        AccountPermissionSyncJobStatus.PENDING,
                                                        AccountPermissionSyncJobStatus.IN_PROGRESS,
                                                    ],
                                                }
                                            },
                                            // Don't schedule if there are recent failed jobs (within the threshold date). Note `gt` is used here since this is a inverse condition.
                                            {
                                                AND: [
                                                    { status: AccountPermissionSyncJobStatus.FAILED },
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

            await this.schedulePermissionSync(accounts);
        }, 1000 * 5);
    }

    public async dispose() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        await this.worker.close();
        await this.queue.close();
    }

    private async schedulePermissionSync(accounts: Account[]) {
        // @note: we don't perform this in a transaction because
        // we want to avoid the situation where a job is created and run
        // prior to the transaction being committed.
        const jobs = await this.db.accountPermissionSyncJob.createManyAndReturn({
            data: accounts.map(account => ({
                accountId: account.id,
            })),
        });

        await this.queue.addBulk(jobs.map((job) => ({
            name: 'accountPermissionSyncJob',
            data: {
                jobId: job.id,
            },
            opts: {
                removeOnComplete: env.REDIS_REMOVE_ON_COMPLETE,
                removeOnFail: env.REDIS_REMOVE_ON_FAIL,
            }
        })))
    }

    private async runJob(job: Job<AccountPermissionSyncJob>) {
        const id = job.data.jobId;
        const logger = createJobLogger(id);

        const { account } = await this.db.accountPermissionSyncJob.update({
            where: {
                id,
            },
            data: {
                status: AccountPermissionSyncJobStatus.IN_PROGRESS,
            },
            select: {
                account: {
                    include: {
                        user: true,
                    }
                }
            }
        });

        logger.info(`Syncing permissions for ${account.provider} account (id: ${account.id}) for user ${account.user.email}...`);

        // Get a list of all repos that the user has access to from all connected accounts.
        const repoIds = await (async () => {
            const aggregatedRepoIds: Set<number> = new Set();

            if (account.provider === 'github') {
                if (!account.access_token) {
                    throw new Error(`User '${account.user.email}' does not have an GitHub OAuth access token associated with their GitHub account.`);
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
            } else if (account.provider === 'gitlab') {
                if (!account.access_token) {
                    throw new Error(`User '${account.user.email}' does not have a GitLab OAuth access token associated with their GitLab account.`);
                }

                const api = await createGitLabFromOAuthToken({
                    oauthToken: account.access_token,
                    url: env.AUTH_EE_GITLAB_BASE_URL,
                });

                // @note: we only care about the private and internal repos since we don't need to build a mapping
                // for public repos.
                // @see: packages/web/src/prisma.ts
                const privateGitLabProjects = await getProjectsForAuthenticatedUser('private', api);
                const internalGitLabProjects = await getProjectsForAuthenticatedUser('internal', api);

                const gitLabProjectIds = [
                    ...privateGitLabProjects,
                    ...internalGitLabProjects,
                ].map(project => project.id.toString());

                const repos = await this.db.repo.findMany({
                    where: {
                        external_codeHostType: 'gitlab',
                        external_id: {
                            in: gitLabProjectIds,
                        }
                    }
                });

                repos.forEach(repo => aggregatedRepoIds.add(repo.id));
            }

            return Array.from(aggregatedRepoIds);
        })();

        await this.db.$transaction([
            this.db.account.update({
                where: {
                    id: account.id,
                },
                data: {
                    accessibleRepos: {
                        deleteMany: {},
                    }
                }
            }),
            this.db.accountToRepoPermission.createMany({
                data: repoIds.map(repoId => ({
                    accountId: account.id,
                    repoId,
                })),
                skipDuplicates: true,
            })
        ]);
    }

    private async onJobCompleted(job: Job<AccountPermissionSyncJob>) {
        const logger = createJobLogger(job.data.jobId);

        const { account } = await this.db.accountPermissionSyncJob.update({
            where: {
                id: job.data.jobId,
            },
            data: {
                status: AccountPermissionSyncJobStatus.COMPLETED,
                account: {
                    update: {
                        permissionSyncedAt: new Date(),
                    },
                },
                completedAt: new Date(),
            },
            select: {
                account: {
                    include: {
                        user: true,
                    }
                }
            }
        });

        logger.info(`Permissions synced for ${account.provider} account (id: ${account.id}) for user ${account.user.email}`);
    }

    private async onJobFailed(job: Job<AccountPermissionSyncJob> | undefined, err: Error) {
        const logger = createJobLogger(job?.data.jobId ?? 'unknown');

        Sentry.captureException(err, {
            tags: {
                jobId: job?.data.jobId,
                queue: QUEUE_NAME,
            }
        });

        const errorMessage = (accountId: string, email: string) => `Account permission sync job failed for account (id: ${accountId}) for user ${email}: ${err.message}`;

        if (job) {
            const { account } = await this.db.accountPermissionSyncJob.update({
                where: {
                    id: job.data.jobId,
                },
                data: {
                    status: AccountPermissionSyncJobStatus.FAILED,
                    completedAt: new Date(),
                    errorMessage: err.message,
                },
                select: {
                    account: {
                        include: {
                            user: true,
                        }
                    }
                }
            });

            logger.error(errorMessage(account.id, account.user.email ?? 'unknown user (email not found)'));
        } else {
            logger.error(errorMessage('unknown account (id not found)', 'unknown user (id not found)'));
        }
    }
}