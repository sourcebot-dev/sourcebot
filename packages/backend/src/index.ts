import "./instrument.js";

import { PrismaClient } from "@sourcebot/db";
import { createLogger, env, getConfigSettings, getDBConnectionString, hasEntitlement } from "@sourcebot/shared";
import 'express-async-errors';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { Redis } from 'ioredis';
import { Api } from "./api.js";
import { ConfigManager } from "./configManager.js";
import { ConnectionManager } from './connectionManager.js';
import { INDEX_CACHE_DIR, REPOS_CACHE_DIR } from './constants.js';
import { AccountPermissionSyncer } from "./ee/accountPermissionSyncer.js";
import { GithubAppManager } from "./ee/githubAppManager.js";
import { RepoPermissionSyncer } from './ee/repoPermissionSyncer.js';
import { shutdownPosthog } from "./posthog.js";
import { PromClient } from './promClient.js';
import { RepoIndexManager } from "./repoIndexManager.js";

const logger = createLogger('backend-entrypoint');

const reposPath = REPOS_CACHE_DIR;
const indexPath = INDEX_CACHE_DIR;

if (!existsSync(reposPath)) {
    await mkdir(reposPath, { recursive: true });
}
if (!existsSync(indexPath)) {
    await mkdir(indexPath, { recursive: true });
}

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: getDBConnectionString(),
        },
    },
});

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

const settings = await getConfigSettings(env.CONFIG_PATH);

if (hasEntitlement('github-app')) {
    await GithubAppManager.getInstance().init(prisma);
}

const connectionManager = new ConnectionManager(prisma, settings, redis, promClient);
const repoPermissionSyncer = new RepoPermissionSyncer(prisma, settings, redis);
const accountPermissionSyncer = new AccountPermissionSyncer(prisma, settings, redis);
const repoIndexManager = new RepoIndexManager(prisma, settings, redis, promClient);
const configManager = new ConfigManager(prisma, connectionManager, env.CONFIG_PATH);

connectionManager.startScheduler();
repoIndexManager.startScheduler();

if (env.EXPERIMENT_EE_PERMISSION_SYNC_ENABLED === 'true' && !hasEntitlement('permission-syncing')) {
    logger.error('Permission syncing is not supported in current plan. Please contact team@sourcebot.dev for assistance.');
    process.exit(1);
}
else if (env.EXPERIMENT_EE_PERMISSION_SYNC_ENABLED === 'true' && hasEntitlement('permission-syncing')) {
    repoPermissionSyncer.startScheduler();
    accountPermissionSyncer.startScheduler();
}

const api = new Api(
    promClient,
    prisma,
    connectionManager,
    repoIndexManager,
);

logger.info('Worker started.');

const cleanup = async (signal: string) => {
    logger.info(`Received ${signal}, cleaning up...`);

    const shutdownTimeout = 30000; // 30 seconds

    try {
        await Promise.race([
            Promise.all([
                repoIndexManager.dispose(),
                connectionManager.dispose(),
                repoPermissionSyncer.dispose(),
                accountPermissionSyncer.dispose(),
                configManager.dispose(),
            ]),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Shutdown timeout')), shutdownTimeout)
            )
        ]);
        logger.info('All workers shut down gracefully');
    } catch (error) {
        logger.warn('Shutdown timeout or error, forcing exit:', error instanceof Error ? error.message : String(error));
    }

    await prisma.$disconnect();
    await redis.quit();
    await api.dispose();
    await shutdownPosthog();
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
