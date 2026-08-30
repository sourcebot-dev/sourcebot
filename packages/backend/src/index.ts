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
import { createConnectionSyncWorkload } from "./connectionSyncWorkload.js";
import { cleanupOrphanedRepoResources, createRepoCleanupWorkload, reindexReposWithMissingShards } from "./repoCleanupWorkload.js";
import { createRepoIndexWorkload } from "./repoIndexWorkload.js";
import { Api } from "./api.js";
import { createAccountPermissionSyncWorkload } from "./ee/accountPermissionSyncWorkload.js";
import { createRepoPermissionSyncWorkload } from "./ee/repoPermissionSyncWorkload.js";
import { reconcileJobSchedulers } from "./reconcileJobSchedulers.js";
import { createAttachmentPruneWorkload } from "./attachmentPruneWorkload.js";
import { createAuditLogPruneWorkload } from "./ee/auditLogPruneWorkload.js";

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
const promClient = new PromClient();

logger.info('Worker started.');

const jobManager = new BullMQJobManager(redis);

const connectionSyncWorkload = createConnectionSyncWorkload({
    db: prisma,
    jobManager,
    settings,
});
const repoIndexWorkload = createRepoIndexWorkload({
    db: prisma,
    settings,
});
const repoCleanupWorkload = createRepoCleanupWorkload({
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
const attachmentPruneWorkload = createAttachmentPruneWorkload({
    db: prisma,
    ttlHours: env.SOURCEBOT_CHAT_ATTACHMENT_ORPHAN_TTL_HOURS,
});
const auditLogPruneWorkload = createAuditLogPruneWorkload({
    db: prisma,
    enabled: env.SOURCEBOT_EE_AUDIT_LOGGING_ENABLED === "true",
    retentionDays: env.SOURCEBOT_EE_AUDIT_RETENTION_DAYS,
});

jobManager.register(connectionSyncWorkload);
jobManager.register(repoIndexWorkload);
jobManager.register(repoCleanupWorkload);
jobManager.register(accountPermissionSyncWorkload);
jobManager.register(repoPermissionSyncWorkload);
jobManager.register(attachmentPruneWorkload);
jobManager.register(auditLogPruneWorkload);

const api = new Api(promClient, prisma, jobManager, redis, settings);

await cleanupOrphanedRepoResources(prisma);
await reindexReposWithMissingShards(prisma, jobManager);

const configManager = new ConfigManager(jobManager, env.CONFIG_PATH);
await configManager.syncConfig();

await reconcileJobSchedulers({
    db: prisma,
    jobManager,
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
            await api.dispose();
            await jobManager.stop();

            await prisma.$disconnect();
            await redis.quit();
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
