import { PrismaClient } from '@sourcebot/db';
import { createLogger } from "./logger.js";
import { AppContext } from "./types.js";
import { DEFAULT_SETTINGS } from './constants.js';
import { Redis } from 'ioredis';
import { ConnectionManager } from './connectionManager.js';
import { RepoManager } from './repoManager.js';
import { env } from './env.js';
import { PromClient } from './promClient.js';

const logger = createLogger('main');

export const main = async (db: PrismaClient, context: AppContext) => {
    const redis = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: null
    });
    redis.ping().then(() => {
        logger.info('Connected to redis');
    }).catch((err: unknown) => {
        logger.error('Failed to connect to redis');
        console.error(err);
        process.exit(1);
    });

    const settings = DEFAULT_SETTINGS;
    if (env.INDEX_CONCURRENCY_MULTIPLE) {
        settings.indexConcurrencyMultiple = env.INDEX_CONCURRENCY_MULTIPLE;
    }

    const promClient = new PromClient();

    const connectionManager = new ConnectionManager(db, settings, redis);
    connectionManager.registerPollingCallback();

    const repoManager = new RepoManager(db, settings, redis, promClient, context);
    await repoManager.blockingPollLoop();
}
