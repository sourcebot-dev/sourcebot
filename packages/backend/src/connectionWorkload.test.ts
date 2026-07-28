import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
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

vi.mock('./prisma.js', () => ({
    prisma: {
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

describe('connectionWorkload', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('does not declare database-backed lifecycle hooks', () => {
        expect(connectionWorkload.queueSpec.onEnqueued).toBeUndefined();
        expect(connectionWorkload.onStarted).toBeUndefined();
        expect(connectionWorkload.onCompleted).toBeUndefined();
        expect(connectionWorkload.onTerminalFailure).toBeUndefined();
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
        expect(result).toBeUndefined();
    });
});
