import "./instrument.js";

import * as Sentry from "@sentry/node";
import { createLogger, env, getConfigSettings } from "@sourcebot/shared";
import 'express-async-errors';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { ConfigManager } from "./configManager.js";
import { INDEX_CACHE_DIR, REPOS_CACHE_DIR, SHUTDOWN_SIGNALS, SINGLE_TENANT_ORG_ID } from './constants.js';
import { GithubAppManager } from "./ee/githubAppManager.js";
import { hasEntitlement } from "./entitlements.js";
import { BullMQJobManager } from "./jobManager.js";
import { shutdownPosthog } from "./posthog.js";
import { prisma } from "./prisma.js";
import { PromClient } from './promClient.js';
import { redis } from "./redis.js";
import { QueueSpec, Workload } from "./types.js";
import { connectionWorkload } from "./connectionWorkload.js";

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

const promClient = new PromClient();

const settings = await getConfigSettings(env.CONFIG_PATH);

if (await hasEntitlement('github-app')) {
    await GithubAppManager.getInstance().init(prisma);
}

// const connectionManager = new ConnectionManager(prisma, settings, redis, promClient);
// const repoPermissionSyncer = new RepoPermissionSyncer(prisma, settings, redis);
// const accountPermissionSyncer = new AccountPermissionSyncer(prisma, settings, redis);
// const repoIndexManager = new RepoIndexManager(prisma, settings, redis, promClient);
// const auditLogPruner = new AuditLogPruner(prisma);
// const attachmentPruner = new AttachmentPruner(prisma);

// connectionManager.startScheduler();
// await repoIndexManager.startScheduler();
// auditLogPruner.startScheduler();
// attachmentPruner.startScheduler();

// if (env.PERMISSION_SYNC_ENABLED === 'true' && !await hasEntitlement('permission-syncing')) {
//     logger.warn('Permission syncing is not supported in current plan. Please contact team@sourcebot.dev for assistance.');
// }
// else if (env.PERMISSION_SYNC_ENABLED === 'true' && await hasEntitlement('permission-syncing')) {
//     if (env.PERMISSION_SYNC_REPO_DRIVEN_ENABLED === 'true') {
//         await repoPermissionSyncer.startScheduler();
//     }
//     await accountPermissionSyncer.startScheduler();
// }

// const api = new Api(
//     promClient,
//     prisma,
//     connectionManager,
//     repoIndexManager,
//     accountPermissionSyncer,
// );

logger.info('Worker started.');

// Background jobs run through the JobManager (BullMQ/Redis as the source of truth). Phase 0
// wires the framework here in place of the old per-manager pollers; the real workloads
// (repo-index, connection-sync, permission syncers) are ported onto it in subsequent phases.
const jobManager = new BullMQJobManager(redis);

const cronQueueSpec: QueueSpec<'cron'> = {
    name: 'cron',
    jobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delayMs: 5000 },
        keep: { completed: 50, failed: 50 }
    }
}

const cronWorkload: Workload<'cron'> = {
    concurrency: 1,
    schedule: { every: '5s' },
    spec: cronQueueSpec,
    process: async ({ jobId, trigger }) => {
        console.log(`cron ${jobId}`);

        const thresholdDate = new Date(Date.now() - settings.resyncConnectionIntervalMs);
        const connections = await prisma.connection.findMany({
            where: {
                OR: [
                    { syncedAt: null },
                    { syncedAt: { lt: thresholdDate }}
                ]
            }
        });

        await Promise.all(connections.map(async (connection) => {
            console.log(`Scheduling work for ${connection.id}`);
            await trigger('connection', {
                connectionId: connection.id,
                orgId: SINGLE_TENANT_ORG_ID,
            })
        }))
    }
}

jobManager.register(cronWorkload);
jobManager.register(connectionWorkload);

await jobManager.start();

const configManager = new ConfigManager(jobManager, env.CONFIG_PATH);


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

            // await repoIndexManager.dispose()
            // await connectionManager.dispose()
            // await repoPermissionSyncer.dispose()
            // await accountPermissionSyncer.dispose()
            // await auditLogPruner.dispose()
            // await attachmentPruner.dispose()
            await configManager.dispose()
            await jobManager.stop();

            await prisma.$disconnect();
            await redis.quit();
            // await api.dispose();
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
