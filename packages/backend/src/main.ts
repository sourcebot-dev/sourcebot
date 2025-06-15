import { PrismaClient } from '@sourcebot/db';
import { createLogger } from "@sourcebot/logger";
import { AppContext } from "./types.js";
import { DEFAULT_SETTINGS, SINGLE_TENANT_ORG_DOMAIN, SINGLE_TENANT_ORG_ID, SINGLE_TENANT_ORG_NAME } from './constants.js';
import { Redis } from 'ioredis';
import { ConnectionManager } from './connectionManager.js';
import { RepoManager } from './repoManager.js';
import { env } from './env.js';
import { PromClient } from './promClient.js';
import { syncSearchContexts } from './ee/syncSearchContexts.js';

const logger = createLogger('backend-main');

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

    const settings = {
        ...DEFAULT_SETTINGS,
        ...context.config?.settings,
    }

    await db.org.upsert({
        where: {
            id: SINGLE_TENANT_ORG_ID,
        },
        update: {},
        create: {
            name: SINGLE_TENANT_ORG_NAME,
            domain: SINGLE_TENANT_ORG_DOMAIN,
            id: SINGLE_TENANT_ORG_ID
        }
    });

    await syncSearchContexts(db, context.config?.contexts);

    const promClient = new PromClient();

    const connectionManager = new ConnectionManager(db, settings, redis, context);
    connectionManager.registerPollingCallback();

    const repoManager = new RepoManager(db, settings, redis, promClient, context);
    await repoManager.validateIndexedReposHaveShards();
    await repoManager.blockingPollLoop();
}
