import { PrismaClient, Repo, RepoIndexingStatus } from '@sourcebot/db';
import { existsSync, watch } from 'fs';
import { syncConfig } from "./config.js";
import { cloneRepository, fetchRepository } from "./git.js";
import { createLogger } from "./logger.js";
import { captureEvent } from "./posthog.js";
import { AppContext } from "./types.js";
import { getRepoPath, isRemotePath, measure } from "./utils.js";
import { indexGitRepository } from "./zoekt.js";
import { DEFAULT_SETTINGS } from './constants.js';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

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
        try {
            await db.$transaction(async (tx) => {
                await tx.repo.update({
                    where: { id: repo.id },
                    data: { repoIndexingStatus: RepoIndexingStatus.IN_INDEX_QUEUE },
                });

                // Add the job to the queue
                await queue.add('indexJob', repo);
            });

            logger.info(`Added job to queue for repo ${repo.id}`);
        } catch (error) {
            logger.error(`Failed to add job to queue for repo ${repo.id}: ${error}`);
        }
    }
}

export const main = async (db: PrismaClient, context: AppContext) => {
    let abortController = new AbortController();
    let isSyncing = false;
    const _syncConfig = async () => {
        if (isSyncing) {
            abortController.abort();
            abortController = new AbortController();
        }

        logger.info(`Syncing configuration file ${context.configPath} ...`);
        isSyncing = true;

        try {
            const { durationMs } = await measure(() => syncConfig(context.configPath, db, abortController.signal, context))
            logger.info(`Synced configuration file ${context.configPath} in ${durationMs / 1000}s`);
            isSyncing = false;
        } catch (err: any) {
            if (err.name === "AbortError") {
                // @note: If we're aborting, we don't want to set isSyncing to false
                // since it implies another sync is in progress.
            } else {
                isSyncing = false;
                logger.error(`Failed to sync configuration file ${context.configPath} with error:`);
                console.log(err);
            }
        }
    }

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

    const redis = new Redis({
        host: 'localhost',
        port: 6379,
        maxRetriesPerRequest: null
    });
    redis.ping().then(() => {
        logger.info('Connected to redis');
    }).catch((err) => {
        logger.error('Failed to connect to redis');
        console.error(err);
        process.exit(1);
    });

    const indexQueue = new Queue('indexQueue');
    const worker = new Worker('indexQueue', async (job) => {
        const repo = job.data as Repo;

        try {
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
        } catch (err: any) {
            // @todo : better error handling here..
            logger.error(err);
            return false;
        }

        await db.repo.update({
            where: {
                id: repo.id,
            },
            data: {
                indexedAt: new Date(),
                repoIndexingStatus: RepoIndexingStatus.INDEXED,
            }
        });
    }, { connection: redis, concurrency: 10 });

    worker.on('completed', (job) => {
        logger.info(`Job ${job.id} completed`);
    });
    worker.on('failed', (job, err) => {
        logger.info(`Job failed with error: ${err}`);
    });

    while (true) {
        const thresholdDate = new Date(Date.now() - DEFAULT_SETTINGS.reindexIntervalMs);
        const repos = await db.repo.findMany({
            where: {
                AND: [
                    { repoIndexingStatus: { not: RepoIndexingStatus.IN_INDEX_QUEUE } },
                    {
                        OR: [
                            { indexedAt: null },
                            { indexedAt: { lt: thresholdDate } }
                        ],
                    }
                ]
            }
        });
        logger.info(`Found ${repos.length} repos to index...`);
        addReposToQueue(db, indexQueue, repos);

        /*
        for (const repo of repos) {
            try {
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
            } catch (err: any) {
                // @todo : better error handling here..
                logger.error(err);
                continue;
            }

            await db.repo.update({
                where: {
                    id: repo.id,
                },
                data: {
                    indexedAt: new Date(),
                }
            });
        }
        */

        await new Promise(resolve => setTimeout(resolve, 1000));

    }
}
