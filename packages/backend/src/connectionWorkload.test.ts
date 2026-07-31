import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { PrismaClient } from '@sourcebot/db';

const mocks = vi.hoisted(() => ({
    connectionFindUniqueOrThrow: vi.fn(),
    connectionUpdate: vi.fn(),
    connectionSyncJobUpsert: vi.fn(),
    connectionSyncJobUpdate: vi.fn(),
    transactionConnectionUpdate: vi.fn(),
    transactionRepoUpsert: vi.fn(),
    compileGithubConfig: vi.fn(),
    loadConfig: vi.fn(),
    syncSearchContexts: vi.fn(),
}));

vi.mock('@sentry/node', () => ({
    captureException: vi.fn(),
}));

vi.mock('@sourcebot/shared', () => ({
    CONNECTION_QUEUE: {
        name: 'connection-sync',
        dedupKey: ({ connectionId }: { connectionId: number }) => `connection:${connectionId}`,
        jobOptions: {
            attempts: 2,
            backoff: { type: 'exponential', delayMs: 5000 },
            keep: { completed: 50, failed: 50 },
            keepLogs: 500,
        },
    },
    createLogger: vi.fn(() => ({
        debug: vi.fn(),
        error: vi.fn(),
    })),
    env: {
        CONFIG_PATH: '/config.json',
        CONNECTION_MANAGER_UPSERT_TIMEOUT_MS: 60_000,
    },
    loadConfig: mocks.loadConfig,
}));

vi.mock('./repoCompileUtils.js', () => ({
    compileAzureDevOpsConfig: vi.fn(),
    compileBitbucketConfig: vi.fn(),
    compileGenericGitHostConfig: vi.fn(),
    compileGerritConfig: vi.fn(),
    compileGiteaConfig: vi.fn(),
    compileGithubConfig: mocks.compileGithubConfig,
    compileGitlabConfig: vi.fn(),
}));

vi.mock('./ee/syncSearchContexts.js', () => ({
    syncSearchContexts: mocks.syncSearchContexts,
}));

import { createConnectionWorkload } from './connectionWorkload.js';

const transaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({
    connection: {
        update: mocks.transactionConnectionUpdate,
    },
    repo: {
        upsert: mocks.transactionRepoUpsert,
    },
}));

const db = {
    connection: {
        findUniqueOrThrow: mocks.connectionFindUniqueOrThrow,
        update: mocks.connectionUpdate,
    },
    connectionSyncJob: {
        upsert: mocks.connectionSyncJobUpsert,
        update: mocks.connectionSyncJobUpdate,
    },
    $transaction: transaction,
} as unknown as PrismaClient;

const connectionWorkload = createConnectionWorkload({
    db,
    settings: {
        maxConnectionSyncJobConcurrency: 2,
    } as never,
});

const data = {
    connectionId: 42,
    orgId: 7,
};

const lifecycleContext = {
    data,
    jobId: 'job-1',
    attemptsMade: 0,
    maxAttempts: 2,
    prisma: db,
};

describe('connectionWorkload', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('declares database-backed lifecycle hooks', () => {
        expect(connectionWorkload.onStarted).toBeTypeOf('function');
        expect(connectionWorkload.onCompleted).toBeTypeOf('function');
        expect(connectionWorkload.onTerminalFailure).toBeTypeOf('function');
    });

    test('marks the connection sync job as in progress when started', async () => {
        await connectionWorkload.onStarted?.(lifecycleContext);

        expect(mocks.connectionSyncJobUpsert).toHaveBeenCalledWith({
            where: {
                id: 'job-1',
            },
            update: {
                status: 'IN_PROGRESS',
                completedAt: null,
                errorMessage: null,
                warningMessages: [],
            },
            create: {
                id: 'job-1',
                connectionId: 42,
                status: 'IN_PROGRESS',
                warningMessages: [],
            },
        });
    });

    test('marks the connection sync job as completed', async () => {
        await connectionWorkload.onCompleted?.(lifecycleContext, undefined);

        expect(mocks.connectionSyncJobUpdate).toHaveBeenCalledWith({
            where: {
                id: 'job-1',
            },
            data: {
                status: 'COMPLETED',
                completedAt: expect.any(Date),
                errorMessage: null,
            },
        });
    });

    test('marks the connection sync job as failed after terminal failure', async () => {
        await connectionWorkload.onTerminalFailure?.(
            lifecycleContext,
            new Error('Connection credentials expired'),
        );

        expect(mocks.connectionSyncJobUpdate).toHaveBeenCalledWith({
            where: {
                id: 'job-1',
            },
            data: {
                status: 'FAILED',
                completedAt: expect.any(Date),
                errorMessage: 'Connection credentials expired',
            },
        });
    });

    test('discovers repositories using the connection provider', async () => {
        const config = {
            type: 'github' as const,
        };
        mocks.connectionFindUniqueOrThrow.mockResolvedValue({
            id: 42,
            name: 'github',
            config,
        });
        mocks.compileGithubConfig.mockResolvedValue({
            repoData: [],
            warnings: ['Repository was archived'],
        });
        mocks.connectionUpdate.mockResolvedValue({});
        mocks.loadConfig.mockResolvedValue({ contexts: undefined });
        mocks.syncSearchContexts.mockResolvedValue(undefined);
        const updateProgress = vi.fn();
        const logger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            flush: vi.fn(),
        };
        const signal = new AbortController().signal;

        const result = await connectionWorkload.process({
            ...lifecycleContext,
            signal,
            logger,
            updateProgress,
            trigger: vi.fn(),
        });

        expect(mocks.compileGithubConfig).toHaveBeenCalledWith(config, 42, signal);
        expect(logger.info).toHaveBeenCalledWith(
            'Discovered 0 repositories',
            {
                connectionId: 42,
                repositoryCount: 0,
            },
        );
        expect(updateProgress).not.toHaveBeenCalled();
        expect(mocks.connectionSyncJobUpdate).toHaveBeenCalledWith({
            where: {
                id: 'job-1',
            },
            data: {
                warningMessages: ['Repository was archived'],
            },
        });
        expect(result).toBeUndefined();
    });
});
