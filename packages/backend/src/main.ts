import { PrismaClient } from '@sourcebot/db';
import { createLogger } from "./logger.js";
import { AppContext } from "./types.js";
import { DEFAULT_SETTINGS } from './constants.js';
import { Redis } from 'ioredis';
import { ConnectionManager } from './connectionManager.js';
import { RepoManager } from './repoManager.js';

const logger = createLogger('main');

export const main = async (db: PrismaClient, context: AppContext) => {
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

    const connectionManager = new ConnectionManager(db, DEFAULT_SETTINGS, redis);
    connectionManager.registerPollingCallback();

    const repoManager = new RepoManager(db, DEFAULT_SETTINGS, redis, context);
    repoManager.blockingPollLoop();
}
