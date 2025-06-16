import { PrismaClient } from '@sourcebot/db';
import { createLogger } from "@sourcebot/logger";
import { AppContext } from "./types.js";
import { DEFAULT_SETTINGS } from './constants.js';
import { Redis } from 'ioredis';
import { ConnectionManager } from './connectionManager.js';
import { RepoManager } from './repoManager.js';
import { env } from './env.js';
import { PromClient } from './promClient.js';
import { loadConfig } from '@sourcebot/shared';

const logger = createLogger('backend-main');

const getSettings = async (configPath?: string) => {
    if (!configPath) {
        return DEFAULT_SETTINGS;
    }

    const config = await loadConfig(configPath);

    return {
        ...DEFAULT_SETTINGS,
        ...config.settings,
    }
}

export const main = async (db: PrismaClient, context: AppContext) => {
    const redis = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: null
    });
    redis.ping().then(() => {
        logger.info('Connected to redis');
    }).catch((err: unknown) => {
        logger.error('Failed to connect to redis');
        logger.error(err);
        process.exit(1);
    });

    const settings = await getSettings(env.CONFIG_PATH);

    const promClient = new PromClient();

    const connectionManager = new ConnectionManager(db, settings, redis);
    connectionManager.registerPollingCallback();

    const repoManager = new RepoManager(db, settings, redis, promClient, context);
    await repoManager.validateIndexedReposHaveShards();
    await repoManager.blockingPollLoop();
}
