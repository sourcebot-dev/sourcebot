import * as Sentry from "@sentry/node";
import { PrismaClient, Repo, RepoPermissionSyncJobStatus } from "@sourcebot/db";
import { createLogger } from "@sourcebot/logger";
import { hasEntitlement } from "@sourcebot/shared";
import { Job, Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { PERMISSION_SYNC_SUPPORTED_CODE_HOST_TYPES } from "../constants.js";
import { env } from "../env.js";
import { createOctokitFromToken, getRepoCollaborators } from "../github.js";
import { Settings } from "../types.js";
import { getAuthCredentialsForRepo } from "../utils.js";

type RepoPermissionSyncJob = {
    jobId: string;
}

const QUEUE_NAME = 'repoPermissionSyncQueue';

const logger = createLogger('repo-permission-syncer');


export class RepoPermissionSyncer {
    private queue: Queue<RepoPermissionSyncJob>;
    private worker: Worker<RepoPermissionSyncJob>;
    private interval?: NodeJS.Timeout;

    constructor(
        private db: PrismaClient,
        private settings: Settings,
        redis: Redis,
    ) {
        this.queue = new Queue<RepoPermissionSyncJob>(QUEUE_NAME, {
            connection: redis,
        });
        this.worker = new Worker<RepoPermissionSyncJob>(QUEUE_NAME, this.runJob.bind(this), {
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
            // @todo: make this configurable
            const thresholdDate = new Date(Date.now() - this.settings.experiment_repoDrivenPermissionSyncIntervalMs);

            const repos = await this.db.repo.findMany({
                // Repos need their permissions to be synced against the code host when...
                where: {
                    // They belong to a code host that supports permissions syncing
                    AND: [
                        {
                            external_codeHostType: {
                                in: PERMISSION_SYNC_SUPPORTED_CODE_HOST_TYPES,
                            }
                        },
                        {
                            OR: [
                                { permissionSyncedAt: null },
                                { permissionSyncedAt: { lt: thresholdDate } },
                            ],
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
                                                        RepoPermissionSyncJobStatus.PENDING,
                                                        RepoPermissionSyncJobStatus.IN_PROGRESS,
                                                    ],
                                                }
                                            },
                                            // Don't schedule if there are recent failed jobs (within the threshold date). Note `gt` is used here since this is a inverse condition.
                                            {
                                                AND: [
                                                    { status: RepoPermissionSyncJobStatus.FAILED },
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

            await this.schedulePermissionSync(repos);
        }, 1000 * 5);
    }

    public dispose() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.worker.close();
        this.queue.close();
    }

    private async schedulePermissionSync(repos: Repo[]) {
        await this.db.$transaction(async (tx) => {
            const jobs = await tx.repoPermissionSyncJob.createManyAndReturn({
                data: repos.map(repo => ({
                    repoId: repo.id,
                })),
            });

            await this.queue.addBulk(jobs.map((job) => ({
                name: 'repoPermissionSyncJob',
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

    private async runJob(job: Job<RepoPermissionSyncJob>) {
        const id = job.data.jobId;
        const { repo } = await this.db.repoPermissionSyncJob.update({
            where: {
                id,
            },
            data: {
                status: RepoPermissionSyncJobStatus.IN_PROGRESS,
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

        if (!repo) {
            throw new Error(`Repo ${id} not found`);
        }

        logger.info(`Syncing permissions for repo ${repo.displayName}...`);

        const credentials = await getAuthCredentialsForRepo(repo, this.db, logger);
        if (!credentials) {
            throw new Error(`No credentials found for repo ${id}`);
        }

        const userIds = await (async () => {
            if (repo.external_codeHostType === 'github') {
                const { octokit } = await createOctokitFromToken({
                    token: credentials.token,
                    url: credentials.hostUrl,
                });

                // @note: this is a bit of a hack since the displayName _might_ not be set..
                // however, this property was introduced many versions ago and _should_ be set
                // on each connection sync. Let's throw an error just in case.
                if (!repo.displayName) {
                    throw new Error(`Repo ${id} does not have a displayName`);
                }

                const [owner, repoName] = repo.displayName.split('/');

                const collaborators = await getRepoCollaborators(owner, repoName, octokit);
                const githubUserIds = collaborators.map(collaborator => collaborator.id.toString());

                const accounts = await this.db.account.findMany({
                    where: {
                        provider: 'github',
                        providerAccountId: {
                            in: githubUserIds,
                        }
                    },
                    select: {
                        userId: true,
                    },
                });

                return accounts.map(account => account.userId);
            }

            return [];
        })();

        await this.db.$transaction([
            this.db.repo.update({
                where: {
                    id: repo.id,
                },
                data: {
                    permittedUsers: {
                        deleteMany: {},
                    }
                }
            }),
            this.db.userToRepoPermission.createMany({
                data: userIds.map(userId => ({
                    userId,
                    repoId: repo.id,
                })),
            })
        ]);
    }

    private async onJobCompleted(job: Job<RepoPermissionSyncJob>) {
        const { repo } = await this.db.repoPermissionSyncJob.update({
            where: {
                id: job.data.jobId,
            },
            data: {
                status: RepoPermissionSyncJobStatus.COMPLETED,
                repo: {
                    update: {
                        permissionSyncedAt: new Date(),
                    }
                },
                completedAt: new Date(),
            },
            select: {
                repo: true
            }
        });

        logger.info(`Permissions synced for repo ${repo.displayName ?? repo.name}`);
    }

    private async onJobFailed(job: Job<RepoPermissionSyncJob> | undefined, err: Error) {
        Sentry.captureException(err, {
            tags: {
                jobId: job?.data.jobId,
                queue: QUEUE_NAME,
            }
        });

        const errorMessage = (repoName: string) => `Repo permission sync job failed for repo ${repoName}: ${err.message}`;

        if (job) {
            const { repo } = await this.db.repoPermissionSyncJob.update({
                where: {
                    id: job.data.jobId,
                },
                data: {
                    status: RepoPermissionSyncJobStatus.FAILED,
                    completedAt: new Date(),
                    errorMessage: err.message,
                },
                select: {
                    repo: true
                },
            });
            logger.error(errorMessage(repo.displayName ?? repo.name));
        } else {
            logger.error(errorMessage('unknown repo (id not found)'));
        }
    }
}
