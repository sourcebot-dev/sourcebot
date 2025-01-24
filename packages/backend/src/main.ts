import { ConnectionSyncStatus, PrismaClient, Repo, RepoIndexingStatus } from '@sourcebot/db';
import { existsSync } from 'fs';
import { cloneRepository, fetchRepository } from "./git.js";
import { createLogger } from "./logger.js";
import { captureEvent } from "./posthog.js";
import { AppContext } from "./types.js";
import { getRepoPath, measure } from "./utils.js";
import { indexGitRepository } from "./zoekt.js";
import { DEFAULT_SETTINGS } from './constants.js';
import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import * as os from 'os';
import { ConnectionManager } from './connectionManager.js';

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

    const connectionManager = new ConnectionManager(db, DEFAULT_SETTINGS, redis, context);
    setInterval(async () => {
        const configs = await db.connection.findMany({
            where: {
                syncStatus: ConnectionSyncStatus.SYNC_NEEDED,
            }
        });
        for (const config of configs) {
            await connectionManager.scheduleConnectionSync(config);
        }
    }, DEFAULT_SETTINGS.resyncConnectionPollingIntervalMs);
    
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
        addReposToQueue(db, indexQueue, repos);


        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}
