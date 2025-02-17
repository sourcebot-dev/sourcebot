import { Connection, ConnectionSyncStatus, PrismaClient, Prisma, Repo } from "@sourcebot/db";
import { Job, Queue, Worker } from 'bullmq';
import { Settings, WithRequired } from "./types.js";
import { ConnectionConfig } from "@sourcebot/schemas/v3/connection.type";
import { createLogger } from "./logger.js";
import os from 'os';
import { Redis } from 'ioredis';
import { RepoData, compileGithubConfig, compileGitlabConfig, compileGiteaConfig, compileGerritConfig } from "./repoCompileUtils.js";

interface IConnectionManager {
    scheduleConnectionSync: (connection: Connection) => Promise<void>;
    registerPollingCallback: () => void;
    dispose: () => void;
}

const QUEUE_NAME = 'connectionSyncQueue';

type JobPayload = {
    connectionId: number,
    orgId: number,
    config: ConnectionConfig,
};

export class ConnectionManager implements IConnectionManager {
    private queue = new Queue<JobPayload>(QUEUE_NAME);
    private worker: Worker;
    private logger = createLogger('ConnectionManager');

    constructor(
        private db: PrismaClient,
        private settings: Settings,
        redis: Redis,
    ) {
        const numCores = os.cpus().length;
        this.worker = new Worker(QUEUE_NAME, this.runSyncJob.bind(this), {
            connection: redis,
            concurrency: numCores * this.settings.configSyncConcurrencyMultiple,
        });
        this.worker.on('completed', this.onSyncJobCompleted.bind(this));
        this.worker.on('failed', this.onSyncJobFailed.bind(this));
    }

    public async scheduleConnectionSync(connection: Connection) {
        await this.db.$transaction(async (tx) => {
            await tx.connection.update({
                where: { id: connection.id },
                data: { syncStatus: ConnectionSyncStatus.IN_SYNC_QUEUE },
            });

            const connectionConfig = connection.config as unknown as ConnectionConfig;

            await this.queue.add('connectionSyncJob', {
                connectionId: connection.id,
                orgId: connection.orgId,
                config: connectionConfig,
            });
            this.logger.info(`Added job to queue for connection ${connection.id}`);
        }).catch((err: unknown) => {
            this.logger.error(`Failed to add job to queue for connection ${connection.id}: ${err}`);
        });
    }

    public async registerPollingCallback() {
        setInterval(async () => {
            const connections = await this.db.connection.findMany({
                where: {
                    syncStatus: ConnectionSyncStatus.SYNC_NEEDED,
                }
            });
            for (const connection of connections) {
                await this.scheduleConnectionSync(connection);
            }
        }, this.settings.resyncConnectionPollingIntervalMs);
    }

    private async runSyncJob(job: Job<JobPayload>) {
        const { config, orgId } = job.data;
        // @note: We aren't actually doing anything with this atm.
        const abortController = new AbortController();

        const repoData: RepoData[] = await (async () => {
            switch (config.type) {
                case 'github': {
                    return await compileGithubConfig(config, job.data.connectionId, orgId, this.db, abortController);
                }
                case 'gitlab': {
                    return await compileGitlabConfig(config, job.data.connectionId, orgId, this.db);
                }
                case 'gitea': {
                    return await compileGiteaConfig(config, job.data.connectionId, orgId, this.db);
                }
                case 'gerrit': {
                    return await compileGerritConfig(config, job.data.connectionId, orgId);
                }
                default: {
                    return [];
                }
            }
        })();

        // Filter out any duplicates by external_id and external_codeHostUrl.
        repoData.filter((repo, index, self) => {
            return index === self.findIndex(r =>
                r.external_id === repo.external_id &&
                r.external_codeHostUrl === repo.external_codeHostUrl
            );
        })

        // @note: to handle orphaned Repos we delete all RepoToConnection records for this connection,
        // and then recreate them when we upsert the repos. For example, if a repo is no-longer
        // captured by the connection's config (e.g., it was deleted, marked archived, etc.), it won't
        // appear in the repoData array above, and so the RepoToConnection record won't be re-created.
        // Repos that have no RepoToConnection records are considered orphaned and can be deleted.
        await this.db.$transaction(async (tx) => {
            const deleteStart = performance.now();
            await tx.connection.update({
                where: {
                    id: job.data.connectionId,
                },
                data: {
                    repos: {
                        deleteMany: {}
                    }
                }
            });
            const deleteDuration = performance.now() - deleteStart;
            this.logger.info(`Deleted all RepoToConnection records for connection ${job.data.connectionId} in ${deleteDuration}ms`);

            const existingRepos: Repo[] = await tx.repo.findMany({
                where: {
                    external_id: {
                        in: repoData.map(repo => repo.external_id),
                    },
                    external_codeHostUrl: {
                        in: repoData.map(repo => repo.external_codeHostUrl),
                    },
                },
            });
            const existingRepoKeys = existingRepos.map(repo => `${repo.external_id}-${repo.external_codeHostUrl}`);

            const existingRepoData = repoData.filter(repo => existingRepoKeys.includes(`${repo.external_id}-${repo.external_codeHostUrl}`));
            const [toCreate, toUpdate] = repoData.reduce<[Prisma.RepoCreateManyInput[], Prisma.RepoUpdateManyMutationInput[]]>(([toCreate, toUpdate], repo) => {
                const existingRepo = existingRepoData.find((r: RepoData) => r.external_id === repo.external_id && r.external_codeHostUrl === repo.external_codeHostUrl);
                if (existingRepo) {
                    const updateRepo: Prisma.RepoUpdateManyMutationInput = {
                        name: repo.name,
                        cloneUrl: repo.cloneUrl,
                        imageUrl: repo.imageUrl,
                        isFork: repo.isFork,
                        isArchived: repo.isArchived,
                        metadata: repo.metadata,
                        external_id: repo.external_id,
                        external_codeHostType: repo.external_codeHostType,
                        external_codeHostUrl: repo.external_codeHostUrl,
                    }
                    toUpdate.push(updateRepo);
                } else {
                    const createRepo: Prisma.RepoCreateManyInput = {
                        name: repo.name,
                        cloneUrl: repo.cloneUrl,
                        imageUrl: repo.imageUrl,
                        isFork: repo.isFork,
                        isArchived: repo.isArchived,
                        metadata: repo.metadata,
                        orgId: job.data.orgId,
                        external_id: repo.external_id,
                        external_codeHostType: repo.external_codeHostType,
                        external_codeHostUrl: repo.external_codeHostUrl,
                    }
                    toCreate.push(createRepo);
                }
                return [toCreate, toUpdate];
            }, [[], []]);

            if (toCreate.length > 0) {
                const createStart = performance.now();
                const createdRepos = await tx.repo.createManyAndReturn({
                    data: toCreate,
                });

                await tx.repoToConnection.createMany({
                    data: createdRepos.map(repo => ({
                        repoId: repo.id,
                        connectionId: job.data.connectionId,
                    })),
                });

                const createDuration = performance.now() - createStart;
                this.logger.info(`Created ${toCreate.length} repos in ${createDuration}ms`);
            }

            if (toUpdate.length > 0) {
                const updateStart = performance.now();

                // Build values string for update query
                const updateValues = toUpdate.map(repo => `(
                    '${repo.name}',
                    '${repo.cloneUrl}', 
                    ${repo.imageUrl ? `'${repo.imageUrl}'` : 'NULL'},
                    ${repo.isFork},
                    ${repo.isArchived},
                    '${JSON.stringify(repo.metadata)}'::jsonb,
                    '${repo.external_id}',
                    '${repo.external_codeHostType}',
                    '${repo.external_codeHostUrl}'
                )`).join(',');

                // Update repos and get their IDs in one quercy
                const updateSql = `
                    WITH updated AS (
                        UPDATE "Repo" r
                        SET
                            name = v.name,
                            "cloneUrl" = v.clone_url,
                            "imageUrl" = v.image_url,
                            "isFork" = v.is_fork,
                            "isArchived" = v.is_archived,
                            metadata = v.metadata,
                            "updatedAt" = NOW()
                        FROM (
                            VALUES ${updateValues}
                        ) AS v(name, clone_url, image_url, is_fork, is_archived, metadata, external_id, external_code_host_type, external_code_host_url)
                        WHERE r.external_id = v.external_id 
                        AND r."external_codeHostUrl" = v.external_code_host_url
                        RETURNING r.id
                    )
                    SELECT id FROM updated
                `;
                const updatedRepoIds = await tx.$queryRawUnsafe<{id: number}[]>(updateSql);

                // Insert repo-connection mappings
                const createConnectionSql = `
                    INSERT INTO "RepoToConnection" ("repoId", "connectionId", "addedAt")
                    SELECT id, ${job.data.connectionId}, NOW()
                    FROM unnest(ARRAY[${updatedRepoIds.map(r => r.id).join(',')}]) AS id
                `;
                await tx.$executeRawUnsafe(createConnectionSql);

                const updateDuration = performance.now() - updateStart;
                this.logger.info(`Updated ${toUpdate.length} repos in ${updateDuration}ms`);
            }
        });
    }


    private async onSyncJobCompleted(job: Job<JobPayload>) {
        this.logger.info(`Connection sync job ${job.id} completed`);
        const { connectionId } = job.data;

        await this.db.connection.update({
            where: {
                id: connectionId,
            },
            data: {
                syncStatus: ConnectionSyncStatus.SYNCED,
                syncedAt: new Date()
            }
        })
    }

    private async onSyncJobFailed(job: Job | undefined, err: unknown) {
        this.logger.info(`Connection sync job failed with error: ${err}`);
        if (job) {
            const { connectionId } = job.data;
            await this.db.connection.update({
                where: {
                    id: connectionId,
                },
                data: {
                    syncStatus: ConnectionSyncStatus.FAILED,
                    syncedAt: new Date()
                }
            })
        }
    }

    public dispose() {
        this.worker.close();
        this.queue.close();
    }
}

