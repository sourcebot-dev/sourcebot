import { ConfigSyncStatus, PrismaClient, Repo, Config, RepoIndexingStatus, Prisma } from '@sourcebot/db';
import { existsSync, watch } from 'fs';
import { fetchConfigFromPath, syncConfig } from "./config.js";
import { cloneRepository, fetchRepository } from "./git.js";
import { createLogger } from "./logger.js";
import { captureEvent } from "./posthog.js";
import { AppContext } from "./types.js";
import { getRepoPath, isRemotePath, measure } from "./utils.js";
import { indexGitRepository } from "./zoekt.js";
import { DEFAULT_SETTINGS } from './constants.js';
import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import * as os from 'os';
import { SOURCEBOT_TENANT_MODE } from './environment.js';
import { SourcebotConfigurationSchema } from './schemas/v2.js';

const logger = createLogger('main');

const syncGitRepository = async (repo: Repo, ctx: AppContext) => {
    let fetchDuration_s: number | undefined = undefined;
    let cloneDuration_s: number | undefined = undefined;

    const repoPath = getRepoPath(repo, ctx);
    const metadata = repo.metadata as Record<string, string>;

    if (existsSync(repoPath)) {
        logger.info(`Fetching ${repo.id}...`);

        const { durationMs } = await measure(() => fetchRepository(repoPath, ({ method, stage, progress }) => {
            logger.info(`git.${method} ${stage} stage ${progress}% complete for ${repo.id}`)
        }));
        fetchDuration_s = durationMs / 1000;

        process.stdout.write('\n');
        logger.info(`Fetched ${repo.name} in ${fetchDuration_s}s`);

    } else {
        logger.info(`Cloning ${repo.id}...`);

        const { durationMs } = await measure(() => cloneRepository(repo.cloneUrl, repoPath, metadata, ({ method, stage, progress }) => {
            logger.info(`git.${method} ${stage} stage ${progress}% complete for ${repo.id}`)
        }));
        cloneDuration_s = durationMs / 1000;

        process.stdout.write('\n');
        logger.info(`Cloned ${repo.id} in ${cloneDuration_s}s`);
    }

    logger.info(`Indexing ${repo.id}...`);
    const { durationMs } = await measure(() => indexGitRepository(repo, ctx));
    const indexDuration_s = durationMs / 1000;
    logger.info(`Indexed ${repo.id} in ${indexDuration_s}s`);

    return {
        fetchDuration_s,
        cloneDuration_s,
        indexDuration_s,
    }
}

async function addConfigsToQueue(db: PrismaClient, queue: Queue, configs: Config[]) {
    for (const config of configs) {
        await db.$transaction(async (tx) => {
            await tx.config.update({
                where: { id: config.id },
                data: { syncStatus: ConfigSyncStatus.IN_SYNC_QUEUE },
            });

            // Add the job to the queue
            await queue.add('configSyncJob', config);
            logger.info(`Added job to queue for config ${config.id}`);
        }).catch((err: unknown) => {
            logger.error(`Failed to add job to queue for config ${config.id}: ${err}`);
        });
    }
}

async function addReposToQueue(db: PrismaClient, queue: Queue, repos: Repo[]) {
    for (const repo of repos) {
        await db.$transaction(async (tx) => {
            await tx.repo.update({
                where: { id: repo.id },
                data: { repoIndexingStatus: RepoIndexingStatus.IN_INDEX_QUEUE },
            });

            // Add the job to the queue
            await queue.add('indexJob', repo);
            logger.info(`Added job to queue for repo ${repo.id}`);
        }).catch((err: unknown) => {
            logger.error(`Failed to add job to queue for repo ${repo.id}: ${err}`);
        });
    }
}

export const main = async (db: PrismaClient, context: AppContext) => {
    let abortController = new AbortController();
    let isSyncing = false;
    const _syncConfig = async (dbConfig?: Config | undefined) => {

        // Fetch config object and update syncing status
        let config: SourcebotConfigurationSchema;
        switch (SOURCEBOT_TENANT_MODE) {
            case 'single':
                logger.info(`Syncing configuration file ${context.configPath} ...`);

                if (isSyncing) {
                    abortController.abort();
                    abortController = new AbortController();
                }
                config = await fetchConfigFromPath(context.configPath, abortController.signal);
                isSyncing = true;
                break;
            case 'multi':
                if(!dbConfig) {
                    throw new Error('config object is required in multi tenant mode');
                }
                config = dbConfig.data as SourcebotConfigurationSchema
                db.config.update({
                    where: {
                        id: dbConfig.id,
                    },
                    data: {
                        syncStatus: ConfigSyncStatus.SYNCING,
                    }
                })
                break;
            default:
                throw new Error(`Invalid SOURCEBOT_TENANT_MODE: ${SOURCEBOT_TENANT_MODE}`);
        }

        // Attempt to sync the config, handle failure cases
        try {
            const { durationMs } = await measure(() => syncConfig(config, db, abortController.signal, context))
            logger.info(`Synced configuration in ${durationMs / 1000}s`);
            isSyncing = false;
        } catch (err: any) {
            switch(SOURCEBOT_TENANT_MODE) {
                case 'single':
                    if (err.name === "AbortError") {
                        // @note: If we're aborting, we don't want to set isSyncing to false
                        // since it implies another sync is in progress.
                    } else {
                        isSyncing = false;
                        logger.error(`Failed to sync configuration file with error:`);
                        console.log(err);
                    }
                    break;
                case 'multi':
                    if (dbConfig) {
                        await db.config.update({
                            where: {
                                id: dbConfig.id,
                            },
                            data: {
                                syncStatus: ConfigSyncStatus.FAILED,
                            }
                        })
                        logger.error(`Failed to sync configuration ${dbConfig.id} with error: ${err}`);
                    } else {
                        logger.error(`DB config undefined. Failed to sync configuration with error: ${err}`);
                    }
                    break;
                default:
                    throw new Error(`Invalid SOURCEBOT_TENANT_MODE: ${SOURCEBOT_TENANT_MODE}`);
            }
        }
    }

    /////////////////////////////
    // Init Redis
    /////////////////////////////
    const redis = new Redis({
        host: 'localhost',
        port: 6379,
        maxRetriesPerRequest: null
    });
    redis.ping().then(() => {
        logger.info('Connected to redis');
    }).catch((err: unknown) => {
        logger.error('Failed to connect to redis');
        console.error(err);
        process.exit(1);
    });

    /////////////////////////////
    // Setup config sync watchers
    /////////////////////////////
    switch (SOURCEBOT_TENANT_MODE) {
        case 'single':
            // Re-sync on file changes if the config file is local
            if (!isRemotePath(context.configPath)) {
                watch(context.configPath, () => {
                    logger.info(`Config file ${context.configPath} changed. Re-syncing...`);
                    _syncConfig();
                });
            }
        
            // Re-sync at a fixed interval
            setInterval(() => {
                _syncConfig();
            }, DEFAULT_SETTINGS.resyncIntervalMs);
        
            // Sync immediately on startup
            await _syncConfig();
            break;
        case 'multi':
            // Setup config sync queue and workers
            const configSyncQueue = new Queue('configSyncQueue');
            const numCores = os.cpus().length;
            const numWorkers = numCores * DEFAULT_SETTINGS.configSyncConcurrencyMultiple;
            logger.info(`Detected ${numCores} cores. Setting config sync max concurrency to ${numWorkers}`);
            const configSyncWorker = new Worker('configSyncQueue', async (job: Job) => {
                const config = job.data as Config;
                await _syncConfig(config);
            }, { connection: redis, concurrency: numWorkers });
            configSyncWorker.on('completed', async (job: Job) => {
                logger.info(`Config sync job ${job.id} completed`);

                const config = job.data as Config;
                await db.config.update({
                    where: {
                        id: config.id,
                    },
                    data: {
                        syncStatus: ConfigSyncStatus.SYNCED,
                    }
                })
            });
            configSyncWorker.on('failed', (job: Job | undefined, err: unknown) => {
                logger.info(`Config sync job failed with error: ${err}`);
            });

            setInterval(async () => {
                const configs = await db.config.findMany({
                    where: {
                        syncStatus: ConfigSyncStatus.SYNC_NEEDED,
                    }
                });

                logger.info(`Found ${configs.length} configs to sync...`);
                addConfigsToQueue(db, configSyncQueue, configs);
            }, 1000);
            break;
        default:
            throw new Error(`Invalid SOURCEBOT_TENANT_MODE: ${SOURCEBOT_TENANT_MODE}`);
    }


    /////////////////////////
    // Setup repo indexing
    /////////////////////////
    const indexQueue = new Queue('indexQueue');

    const numCores = os.cpus().length;
    const numWorkers = numCores * DEFAULT_SETTINGS.indexConcurrencyMultiple;
    logger.info(`Detected ${numCores} cores. Setting repo index max concurrency to ${numWorkers}`);
    const worker = new Worker('indexQueue', async (job: Job) => {
        const repo = job.data as Repo;

        let indexDuration_s: number | undefined;
        let fetchDuration_s: number | undefined;
        let cloneDuration_s: number | undefined;

        const stats = await syncGitRepository(repo, context);
        indexDuration_s = stats.indexDuration_s;
        fetchDuration_s = stats.fetchDuration_s;
        cloneDuration_s = stats.cloneDuration_s;

        captureEvent('repo_synced', {
            vcs: 'git',
            codeHost: repo.external_codeHostType,
            indexDuration_s,
            fetchDuration_s,
            cloneDuration_s,
        });

        await db.repo.update({
            where: {
                id: repo.id,
            },
            data: {
                indexedAt: new Date(),
                repoIndexingStatus: RepoIndexingStatus.INDEXED,
            }
        });
    }, { connection: redis, concurrency: numWorkers });

    worker.on('completed', (job: Job) => {
        logger.info(`Job ${job.id} completed`);
    });
    worker.on('failed', async (job: Job | undefined, err: unknown) => {
        logger.info(`Job failed with error: ${err}`);
        if (job) {
            await db.repo.update({
                where: {
                    id: job.data.id,
                },
                data: {
                    repoIndexingStatus: RepoIndexingStatus.FAILED,
                }
            })
        }
    });

    // Repo indexing loop
    while (true) {
        const thresholdDate = new Date(Date.now() - DEFAULT_SETTINGS.reindexIntervalMs);
        const repos = await db.repo.findMany({
            where: {
                repoIndexingStatus: {
                    notIn: [RepoIndexingStatus.IN_INDEX_QUEUE, RepoIndexingStatus.FAILED]
                },
                OR: [
                    { indexedAt: null },
                    { indexedAt: { lt: thresholdDate } },
                    { repoIndexingStatus: RepoIndexingStatus.NEW }
                ]
            }
        });
        logger.info(`Found ${repos.length} repos to index...`);
        addReposToQueue(db, indexQueue, repos);


        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}
