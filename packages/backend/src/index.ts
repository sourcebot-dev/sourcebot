import "./instrument.js";

import * as Sentry from "@sentry/node";
import { createLogger, env, getConfigSettings } from "@sourcebot/shared";
import 'express-async-errors';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { ConfigManager } from "./configManager.js";
import { INDEX_CACHE_DIR, REPOS_CACHE_DIR, SHUTDOWN_SIGNALS } from './constants.js';
import { BullMQJobManager } from "./jobManager.js";
import { shutdownPosthog } from "./posthog.js";
import { prisma } from "./prisma.js";
import { PromClient } from './promClient.js';
import { redis } from "./redis.js";
import { createConnectionWorkload } from "./connectionWorkload.js";
import { cleanupOrphanedRepoResources, createRepoIndexWorkload } from "./repoIndexWorkload.js";
import { Api } from "./api.js";
import { createAccountPermissionSyncWorkload } from "./ee/accountPermissionSyncWorkload.js";
import { createRepoPermissionSyncWorkload } from "./ee/repoPermissionSyncWorkload.js";
import { reconcileJobSchedulersAtStartup } from "./reconcileJobSchedulersAtStartup.js";
import { hasEntitlement } from "./entitlements.js";

const logger = createLogger('backend-entrypoint');

const reposPath = REPOS_CACHE_DIR;
const indexPath = INDEX_CACHE_DIR;

if (!existsSync(reposPath)) {
    await mkdir(reposPath, { recursive: true });
}
if (!existsSync(indexPath)) {
    await mkdir(indexPath, { recursive: true });
}


try {
    await redis.ping();
    logger.debug('Connected to redis');
} catch (err: unknown) {
    logger.error('Failed to connect to redis. Error:', err);
    process.exit(1);
}


const settings = await getConfigSettings(env.CONFIG_PATH);
const permissionSyncEnabled =
    env.PERMISSION_SYNC_ENABLED === "true" &&
    (await hasEntitlement("permission-syncing"));

const promClient = new PromClient();

logger.info('Worker started.');

const jobManager = new BullMQJobManager(redis);

const connectionWorkload = createConnectionWorkload({
    db: prisma,
    jobManager,
    permissionSyncEnabled,
    settings,
});
const repoIndexWorkload = createRepoIndexWorkload({
    db: prisma,
    settings,
});
const accountPermissionSyncWorkload = createAccountPermissionSyncWorkload({
    db: prisma,
    settings,
});
const repoPermissionSyncWorkload = createRepoPermissionSyncWorkload({
    db: prisma,
    settings,
});

jobManager.register(connectionWorkload);
jobManager.register(repoIndexWorkload);
jobManager.register(accountPermissionSyncWorkload);
jobManager.register(repoPermissionSyncWorkload);

const api = new Api(promClient, prisma, jobManager);

await cleanupOrphanedRepoResources(prisma);

const configManager = new ConfigManager(jobManager, env.CONFIG_PATH);
await configManager.syncConfig();

await reconcileJobSchedulersAtStartup({
    db: prisma,
    jobManager,
    permissionSyncEnabled,
    settings,
});

await jobManager.start();


const listenToShutdownSignals = () => {
    const signals = SHUTDOWN_SIGNALS;

    let receivedSignal = false;

    const cleanup = async (signal: string) => {
        try {
            if (receivedSignal) {
                return;
            }
            receivedSignal = true;

            logger.info(`Received ${signal}, cleaning up...`);

            await configManager.dispose()
            await jobManager.stop();

            await prisma.$disconnect();
            await redis.quit();
            await api.dispose();
            await shutdownPosthog();

            logger.info('All workers shut down gracefully');
            signals.forEach(sig => process.removeListener(sig, cleanup));
            return 0;
        } catch (error) {
            Sentry.captureException(error);
            logger.error('Error shutting down worker:', error);
            return 1;
        }
    }

    signals.forEach(signal => {
        process.on(signal, (err) => {
            cleanup(err).then(code => {
                process.exit(code);
            });
        });
    });

    // Register handlers for uncaught exceptions and unhandled rejections
    process.on('uncaughtException', (err) => {
        logger.error(`Uncaught exception: ${err.message}`);
        cleanup('uncaughtException').then(() => {
            process.exit(1);
        });
    });

    process.on('unhandledRejection', (reason, promise) => {
        logger.error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
        cleanup('unhandledRejection').then(() => {
            process.exit(1);
        });
    });


}

listenToShutdownSignals();
