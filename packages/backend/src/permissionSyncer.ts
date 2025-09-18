import * as Sentry from "@sentry/node";
import { PrismaClient, Repo, RepoPermissionSyncStatus } from "@sourcebot/db";
import { createLogger } from "@sourcebot/logger";
import { BitbucketConnectionConfig } from "@sourcebot/schemas/v3/bitbucket.type";
import { GiteaConnectionConfig } from "@sourcebot/schemas/v3/gitea.type";
import { GithubConnectionConfig } from "@sourcebot/schemas/v3/github.type";
import { GitlabConnectionConfig } from "@sourcebot/schemas/v3/gitlab.type";
import { Job, Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from "./env.js";
import { createOctokitFromConfig, getUserIdsWithReadAccessToRepo } from "./github.js";
import { RepoWithConnections } from "./types.js";

type RepoPermissionSyncJob = {
    repoId: number;
}

const QUEUE_NAME = 'repoPermissionSyncQueue';

const logger = createLogger('permission-syncer');

const SUPPORTED_CODE_HOST_TYPES = ['github'];

export class RepoPermissionSyncer {
    private queue: Queue<RepoPermissionSyncJob>;
    private worker: Worker<RepoPermissionSyncJob>;

    constructor(
        private db: PrismaClient,
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
        logger.debug('Starting scheduler');

        return setInterval(async () => {
            // @todo: make this configurable
            const thresholdDate = new Date(Date.now() - 1000 * 60 * 60 * 24);
            const repos = await this.db.repo.findMany({
                // Repos need their permissions to be synced against the code host when...
                where: {
                    // They belong to a code host that supports permissions syncing
                    AND: [
                        {
                            external_codeHostType: {
                                in: SUPPORTED_CODE_HOST_TYPES,
                            }
                        },
                        // and, they either require a sync (SYNC_NEEDED) or have been in a completed state (SYNCED or FAILED)
                        // for > some duration (default 24 hours)
                        {
                            OR: [
                                {
                                    permissionSyncStatus: RepoPermissionSyncStatus.SYNC_NEEDED
                                },
                                {
                                    AND: [
                                        {
                                            OR: [
                                                { permissionSyncStatus: RepoPermissionSyncStatus.SYNCED },
                                                { permissionSyncStatus: RepoPermissionSyncStatus.FAILED },
                                            ]
                                        },
                                        {
                                            OR: [
                                                { permissionSyncJobLastCompletedAt: null },
                                                { permissionSyncJobLastCompletedAt: { lt: thresholdDate } }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        },
                    ]
                }
            });

            await this.schedulePermissionSync(repos);
        }, 1000 * 30);
    }

    public dispose() {
        this.worker.close();
        this.queue.close();
    }

    private async schedulePermissionSync(repos: Repo[]) {
        await this.db.$transaction(async (tx) => {
            await tx.repo.updateMany({
                where: { id: { in: repos.map(repo => repo.id) } },
                data: { permissionSyncStatus: RepoPermissionSyncStatus.IN_SYNC_QUEUE },
            });

            await this.queue.addBulk(repos.map(repo => ({
                name: 'repoPermissionSyncJob',
                data: {
                    repoId: repo.id,
                },
                opts: {
                    removeOnComplete: env.REDIS_REMOVE_ON_COMPLETE,
                    removeOnFail: env.REDIS_REMOVE_ON_FAIL,
                }
            })))
        });
    }

    private async runJob(job: Job<RepoPermissionSyncJob>) {
        const id = job.data.repoId;
        const repo = await this.db.repo.update({
            where: {
                id
            },
            data: {
                permissionSyncStatus: RepoPermissionSyncStatus.SYNCING,
            },
            include: {
                connections: {
                    include: {
                        connection: true,
                    },
                },
            },
        });

        if (!repo) {
            throw new Error(`Repo ${id} not found`);
        }

        logger.info(`Syncing permissions for repo ${repo.displayName}...`);

        const connection = getFirstConnectionWithToken(repo);
        if (!connection) {
            throw new Error(`No connection with token found for repo ${id}`);
        }

        const userIds = await (async () => {
            if (connection.connectionType === 'github') {
                const config = connection.config as unknown as GithubConnectionConfig;
                const { octokit } = await createOctokitFromConfig(config, repo.orgId, this.db);

                // @nocheckin - need to handle when repo displayName is not set.
                const [owner, repoName] = repo.displayName!.split('/');

                const githubUserIds = await getUserIdsWithReadAccessToRepo(owner, repoName, octokit);

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

        await this.db.repo.update({
            where: {
                id: repo.id,
            },
            data: {
                permittedUsers: {
                    deleteMany: {},
                }
            }
        });

        await this.db.userToRepoPermission.createMany({
            data: userIds.map(userId => ({
                userId,
                repoId: repo.id,
            })),
        });
    }

    private async onJobCompleted(job: Job<RepoPermissionSyncJob>) {
        const repo = await this.db.repo.update({
            where: {
                id: job.data.repoId,
            },
            data: {
                permissionSyncStatus: RepoPermissionSyncStatus.SYNCED,
                permissionSyncJobLastCompletedAt: new Date(),
            },
        });

        logger.info(`Permissions synced for repo ${repo.displayName ?? repo.name}`);
    }

    private async onJobFailed(job: Job<RepoPermissionSyncJob> | undefined, err: Error) {
        Sentry.captureException(err, {
            tags: {
                repoId: job?.data.repoId,
                queue: QUEUE_NAME,
            }
        });

        const errorMessage = (repoName: string) => `Repo permission sync job failed for repo ${repoName}: ${err}`;

        if (job) {
            const repo = await this.db.repo.update({
                where: {
                    id: job?.data.repoId,
                },
                data: {
                    permissionSyncStatus: RepoPermissionSyncStatus.FAILED,
                    permissionSyncJobLastCompletedAt: new Date(),
                },
            });
            logger.error(errorMessage(repo.displayName ?? repo.name));
        } else {
            logger.error(errorMessage('unknown repo (id not found)'));
        }
    }
}

const getFirstConnectionWithToken = (repo: RepoWithConnections) => {
    for (const { connection } of repo.connections) {
        if (connection.connectionType === 'github') {
            const config = connection.config as unknown as GithubConnectionConfig;
            if (config.token) {
                return connection;
            }
        }
        if (connection.connectionType === 'gitlab') {
            const config = connection.config as unknown as GitlabConnectionConfig;
            if (config.token) {
                return connection;
            }
        }
        if (connection.connectionType === 'gitea') {
            const config = connection.config as unknown as GiteaConnectionConfig;
            if (config.token) {
                return connection;
            }
        }
        if (connection.connectionType === 'bitbucket') {
            const config = connection.config as unknown as BitbucketConnectionConfig;
            if (config.token) {
                return connection;
            }
        }
    }

    return undefined;
}