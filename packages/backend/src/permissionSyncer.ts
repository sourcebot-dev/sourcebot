import { PrismaClient } from "@sourcebot/db";
import { createLogger } from "@sourcebot/logger";
import { BitbucketConnectionConfig } from "@sourcebot/schemas/v3/bitbucket.type";
import { GiteaConnectionConfig } from "@sourcebot/schemas/v3/gitea.type";
import { GithubConnectionConfig } from "@sourcebot/schemas/v3/github.type";
import { GitlabConnectionConfig } from "@sourcebot/schemas/v3/gitlab.type";
import { Job, Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { createOctokitFromConfig, getUserIdsWithReadAccessToRepo } from "./github.js";
import { RepoWithConnections } from "./types.js";

type RepoPermissionSyncJob = {
    repoId: number;
}

const QUEUE_NAME = 'repoPermissionSyncQueue';

const logger = createLogger('permission-syncer');

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
        });
        this.worker.on('completed', this.onJobCompleted.bind(this));
        this.worker.on('failed', this.onJobFailed.bind(this));
    }

    public async scheduleJob(repoId: number) {
        await this.queue.add(QUEUE_NAME, {
            repoId,
        });
    }

    public startScheduler() {
        logger.debug('Starting scheduler');

        // @todo: we should only sync permissions for a repository if it has been at least ~24 hours since the last sync.
        return setInterval(async () => {
            const repos = await this.db.repo.findMany({
                where: {
                    external_codeHostType: {
                        in: ['github'],
                    }
                }
            });

            for (const repo of repos) {
                await this.scheduleJob(repo.id);
            }

        // @todo: make this configurable
        }, 1000 * 60);
    }

    public dispose() {
        this.worker.close();
        this.queue.close();
    }

    private async runJob(job: Job<RepoPermissionSyncJob>) {
        const id = job.data.repoId;
        const repo = await this.db.repo.findUnique({
            where: {
                id,
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

        logger.info(`User IDs with read access to repo ${id}: ${userIds}`);

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
        logger.info(`Repo permission sync job completed for repo ${job.data.repoId}`);
    }

    private async onJobFailed(job: Job<RepoPermissionSyncJob> | undefined, err: Error) {
        logger.error(`Repo permission sync job failed for repo ${job?.data.repoId}: ${err}`);
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