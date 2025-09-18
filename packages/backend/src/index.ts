import "./instrument.js";

import { PrismaClient } from "@sourcebot/db";
import { createLogger } from "@sourcebot/logger";
import { loadConfig } from '@sourcebot/shared';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { Redis } from 'ioredis';
import path from 'path';
import { ConnectionManager } from './connectionManager.js';
import { DEFAULT_SETTINGS } from './constants.js';
import { env } from "./env.js";
import { RepoPermissionSyncer } from './permissionSyncer.js';
import { PromClient } from './promClient.js';
import { RepoManager } from './repoManager.js';
import { AppContext } from "./types.js";


const logger = createLogger('backend-entrypoint');

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


const cacheDir = env.DATA_CACHE_DIR;
const reposPath = path.join(cacheDir, 'repos');
const indexPath = path.join(cacheDir, 'index');

if (!existsSync(reposPath)) {
    await mkdir(reposPath, { recursive: true });
}
if (!existsSync(indexPath)) {
    await mkdir(indexPath, { recursive: true });
}

const context: AppContext = {
    indexPath,
    reposPath,
    cachePath: cacheDir,
}

const prisma = new PrismaClient();

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

const promClient = new PromClient();

const settings = await getSettings(env.CONFIG_PATH);

const connectionManager = new ConnectionManager(prisma, settings, redis);
const repoManager = new RepoManager(prisma, settings, redis, promClient, context);
const permissionSyncer = new RepoPermissionSyncer(prisma, redis);

await repoManager.validateIndexedReposHaveShards();

const connectionManagerInterval = connectionManager.startScheduler();
const repoManagerInterval = repoManager.startScheduler();
const permissionSyncerInterval = env.EXPERIMENT_PERMISSION_SYNC_ENABLED === 'true' ? permissionSyncer.startScheduler() : null;


const cleanup = async (signal: string) => {
    logger.info(`Recieved ${signal}, cleaning up...`);

    if (permissionSyncerInterval) {
        clearInterval(permissionSyncerInterval);
    }

    clearInterval(connectionManagerInterval);
    clearInterval(repoManagerInterval);

    connectionManager.dispose();
    repoManager.dispose();
    permissionSyncer.dispose();

    await prisma.$disconnect();
    await redis.quit();
}

process.on('SIGINT', () => cleanup('SIGINT').finally(() => process.exit(0)));
process.on('SIGTERM', () => cleanup('SIGTERM').finally(() => process.exit(0)));

// Register handlers for uncaught exceptions and unhandled rejections
process.on('uncaughtException', (err) => {
    logger.error(`Uncaught exception: ${err.message}`);
    cleanup('uncaughtException').finally(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
    cleanup('unhandledRejection').finally(() => process.exit(1));
});
