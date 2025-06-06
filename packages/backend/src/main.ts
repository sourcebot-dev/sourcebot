import { PrismaClient } from '@sourcebot/db';
import { createLogger } from "@sourcebot/logger";
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
import { indexSchema } from '@sourcebot/schemas/v3/index.schema';
import { Ajv } from "ajv";

const logger = createLogger('backend-main');
const ajv = new Ajv({
    validateFormats: false,
});

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
    const isValidConfig = ajv.validate(indexSchema, config);
    if (!isValidConfig) {
        throw new Error(`Config file '${configPath}' is invalid: ${ajv.errorsText(ajv.errors)}`);
    }

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
