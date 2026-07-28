import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    connectionSyncJobCreateMany: vi.fn(),
    connectionSyncJobUpdate: vi.fn(),
    connectionFindUniqueOrThrow: vi.fn(),
    connectionUpdate: vi.fn(),
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
        name: 'connection',
        dedupKey: ({ connectionId }: { connectionId: number }) => `connection:${connectionId}`,
        jobOptions: {
            attempts: 2,
            backoff: { type: 'exponential', delayMs: 5000 },
            keep: { completed: 50, failed: 50 },
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

vi.mock('./prisma.js', () => ({
    prisma: {
        connectionSyncJob: {
            createMany: mocks.connectionSyncJobCreateMany,
            update: mocks.connectionSyncJobUpdate,
        },
        connection: {
            findUniqueOrThrow: mocks.connectionFindUniqueOrThrow,
            update: mocks.connectionUpdate,
        },
        $transaction: vi.fn(async (callback) => callback({
            connection: {
                update: mocks.transactionConnectionUpdate,
            },
            repo: {
                upsert: mocks.transactionRepoUpsert,
            },
        })),
    },
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

import { connectionWorkload } from './connectionWorkload.js';

const data = {
    connectionId: 42,
    orgId: 7,
};

const lifecycleContext = {
    data,
    jobId: 'job-1',
    attemptsMade: 0,
    maxAttempts: 2,
};

describe('connectionWorkload lifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-27T12:00:00.000Z'));
        mocks.connectionSyncJobCreateMany.mockResolvedValue({ count: 1 });
        mocks.connectionSyncJobUpdate.mockResolvedValue({});
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('creates a pending ConnectionSyncJob when enqueued', async () => {
        await connectionWorkload.queueSpec.onEnqueued?.(lifecycleContext);

        expect(mocks.connectionSyncJobCreateMany).toHaveBeenCalledWith({
            data: [{
                id: 'job-1',
                connectionId: 42,
                status: 'PENDING',
                warningMessages: [],
            }],
            skipDuplicates: true,
        });
    });

    test('marks the ConnectionSyncJob in progress when processing starts', async () => {
        await connectionWorkload.onStarted?.(lifecycleContext);

        expect(mocks.connectionSyncJobCreateMany).toHaveBeenCalledWith({
            data: [{
                id: 'job-1',
                connectionId: 42,
                status: 'IN_PROGRESS',
                warningMessages: [],
            }],
            skipDuplicates: true,
        });
        expect(mocks.connectionSyncJobUpdate).toHaveBeenCalledWith({
            where: {
                id: 'job-1',
            },
            data: {
                status: 'IN_PROGRESS',
            },
        });
    });

    test('persists compile warnings while processing', async () => {
        mocks.connectionFindUniqueOrThrow.mockResolvedValue({
            id: 42,
            name: 'github',
            config: {
                type: 'github',
            },
        });
        mocks.compileGithubConfig.mockResolvedValue({
            repoData: [],
            warnings: ['Repository was archived'],
        });
        mocks.connectionUpdate.mockResolvedValue({});
        mocks.loadConfig.mockResolvedValue({ contexts: undefined });
        mocks.syncSearchContexts.mockResolvedValue(undefined);

        await connectionWorkload.process({
            ...lifecycleContext,
            signal: new AbortController().signal,
            log: vi.fn(),
            updateProgress: vi.fn(),
            trigger: vi.fn(),
        });

        expect(mocks.connectionSyncJobUpdate).toHaveBeenCalledWith({
            where: {
                id: 'job-1',
            },
            data: {
                warningMessages: ['Repository was archived'],
            },
        });
    });

    test('marks the ConnectionSyncJob completed', async () => {
        await connectionWorkload.onCompleted?.(lifecycleContext, undefined);

        expect(mocks.connectionSyncJobUpdate).toHaveBeenCalledWith({
            where: {
                id: 'job-1',
            },
            data: {
                status: 'COMPLETED',
                completedAt: new Date('2026-07-27T12:00:00.000Z'),
            },
        });
    });

    test('marks the ConnectionSyncJob failed with its error', async () => {
        await connectionWorkload.onTerminalFailure?.(
            { ...lifecycleContext, attemptsMade: 2 },
            new Error('Connection failed'),
        );

        expect(mocks.connectionSyncJobUpdate).toHaveBeenCalledWith({
            where: {
                id: 'job-1',
            },
            data: {
                status: 'FAILED',
                completedAt: new Date('2026-07-27T12:00:00.000Z'),
                errorMessage: 'Connection failed',
            },
        });
    });
});
