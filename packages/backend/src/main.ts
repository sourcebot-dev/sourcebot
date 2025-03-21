import { PrismaClient } from '@sourcebot/db';
import { createLogger } from "./logger.js";
import { AppContext } from "./types.js";
import { DEFAULT_SETTINGS } from './constants.js';
import { Redis } from 'ioredis';
import { ConnectionManager } from './connectionManager.js';
import { RepoManager } from './repoManager.js';
import { env } from './env.js';
import { PromClient } from './promClient.js';
import { isRemotePath } from './utils.js';
import { readFile } from 'fs/promises';
import stripJsonComments from 'strip-json-comments';
import { SourcebotConfig } from '@sourcebot/schemas/v3/index.type';

const logger = createLogger('main');

const getSettings = async (configPath?: string) => {
    if (!configPath) {
        return DEFAULT_SETTINGS;
    }

    const configContent = await (async () => {
        if (isRemotePath(configPath)) {
            const response = await fetch(configPath);
            if (!response.ok) {
                throw new Error(`Failed to fetch config file ${configPath}: ${response.statusText}`);
            }
            return response.text();
        } else {
            return readFile(configPath, { encoding: 'utf-8' });
        }
    })();

    const config = JSON.parse(stripJsonComments(configContent)) as SourcebotConfig;
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
        console.error(err);
        process.exit(1);
    });

    const settings = await getSettings(env.CONFIG_PATH);

    const promClient = new PromClient();

    const connectionManager = new ConnectionManager(db, settings, redis);
    connectionManager.registerPollingCallback();

    const repoManager = new RepoManager(db, settings, redis, promClient, context);
    await repoManager.blockingPollLoop();
}
