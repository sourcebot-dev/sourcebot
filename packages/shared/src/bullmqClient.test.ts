import type { Redis } from 'ioredis';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { QueueSpec } from './queue.js';
import { DEFAULT_JOB_LOGS_MAX_ENTRIES } from './jobLogger.js';
import { CONNECTION_QUEUE, REPO_INDEX_QUEUE } from './queue.js';

const queueMocks = vi.hoisted(() => ({
    add: vi.fn(),
    close: vi.fn(),
    getJob: vi.fn(),
    getJobLogs: vi.fn(),
}));

vi.mock('@sentry/node', () => ({
    captureException: vi.fn(),
}));

vi.mock('./logger.js', () => ({
    createLogger: vi.fn(() => ({
        error: vi.fn(),
    })),
}));

vi.mock('bullmq', () => ({
    Queue: class {
        constructor() {
            return queueMocks;
        }
    },
}));

import { BullMQClient } from './bullmqClient.js';
import { PrismaClient } from '@sourcebot/db';

const connectionSpec: QueueSpec<'connection-sync'> = {
    name: 'connection-sync',
    dedupKey: ({ connectionId }) => `connection:${connectionId}`,
    jobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delayMs: 5000 },
        keep: { completed: 50, failed: 50 },
        keepLogs: DEFAULT_JOB_LOGS_MAX_ENTRIES,
    },
};

const data = { connectionId: 42, orgId: 1 };

describe('BullMQClient', () => {
    const redis = {} as Redis;
    const prisma = {} as PrismaClient;

    beforeEach(() => {
        vi.clearAllMocks();
        queueMocks.add.mockImplementation(async (_name, _data, options) => ({ id: options.jobId }));
    });

    test('returns the job id when BullMQ accepts the proposed id', async () => {
        const client = new BullMQClient(redis, prisma);

        const result = await client.enqueue(connectionSpec, data);

        expect(result).toEqual(expect.any(String));
        expect(queueMocks.add).toHaveBeenCalledWith(
            'connection-sync',
            data,
            expect.objectContaining({
                jobId: result,
                deduplication: { id: 'connection:42' },
                keepLogs: DEFAULT_JOB_LOGS_MAX_ENTRIES,
            }),
        );
    });

    test('calls onEnqueued when a new job is created', async () => {
        const onEnqueued = vi.fn();
        const client = new BullMQClient(redis, prisma);

        const result = await client.enqueue({ ...connectionSpec, onEnqueued }, data);

        expect(onEnqueued).toHaveBeenCalledWith({
            data,
            jobId: result,
            attemptsMade: 0,
            maxAttempts: 2,
            prisma,
        });
    });

    test('returns the existing job id without calling onEnqueued when BullMQ deduplicates the enqueue', async () => {
        const onEnqueued = vi.fn();
        queueMocks.add.mockResolvedValue({ id: 'existing-job' });
        const client = new BullMQClient(redis, prisma);

        const result = await client.enqueue({ ...connectionSpec, onEnqueued }, data);

        expect(result).toBe('existing-job');
        expect(onEnqueued).not.toHaveBeenCalled();
    });

    test('upserts a pending connection sync job when enqueueing a connection sync', async () => {
        const connectionSyncJobUpsert = vi.fn();
        const client = new BullMQClient(redis, {
            connectionSyncJob: {
                upsert: connectionSyncJobUpsert,
            },
        } as unknown as PrismaClient);

        const result = await client.enqueue(CONNECTION_QUEUE, data);

        expect(connectionSyncJobUpsert).toHaveBeenCalledWith({
            where: {
                id: result,
            },
            update: {},
            create: {
                id: result,
                connectionId: 42,
                status: 'PENDING',
                warningMessages: [],
            },
        });
    });

    test('upserts a pending repo indexing job when enqueueing with repo-level deduplication', async () => {
        const repoIndexingJobUpsert = vi.fn();
        const client = new BullMQClient(redis, {
            repoIndexingJob: {
                upsert: repoIndexingJobUpsert,
            },
        } as unknown as PrismaClient);

        const result = await client.enqueue(REPO_INDEX_QUEUE, {
            repoId: 42,
            type: 'INDEX',
        });

        expect(queueMocks.add).toHaveBeenCalledWith(
            'repo-index',
            {
                repoId: 42,
                type: 'INDEX',
            },
            expect.objectContaining({
                deduplication: { id: 'repo:42' },
            }),
        );
        expect(repoIndexingJobUpsert).toHaveBeenCalledWith({
            where: {
                id: result,
            },
            update: {},
            create: {
                id: result,
                repoId: 42,
                type: 'INDEX',
                status: 'PENDING',
            },
        });
    });

    test.each([
        ['waiting', 'PENDING'],
        ['waiting-children', 'PENDING'],
        ['delayed', 'PENDING'],
        ['prioritized', 'PENDING'],
        ['paused', 'PENDING'],
        ['active', 'IN_PROGRESS'],
        ['completed', 'COMPLETED'],
    ])('maps BullMQ state %s to %s', async (state, expectedStatus) => {
        queueMocks.getJob.mockResolvedValue({
            id: 'job-1',
            data,
            getState: vi.fn().mockResolvedValue(state),
        });
        const client = new BullMQClient(redis, prisma);

        await expect(client.getJob(connectionSpec, 'job-1')).resolves.toEqual({
            id: 'job-1',
            data,
            status: expectedStatus,
            errorMessage: null,
        });
    });

    test('returns the failure reason for a failed job', async () => {
        queueMocks.getJob.mockResolvedValue({
            id: 'job-1',
            data,
            failedReason: 'Connection credentials expired',
            getState: vi.fn().mockResolvedValue('failed'),
        });
        const client = new BullMQClient(redis, prisma);

        await expect(client.getJob(connectionSpec, 'job-1')).resolves.toEqual({
            id: 'job-1',
            data,
            status: 'FAILED',
            errorMessage: 'Connection credentials expired',
        });
    });

    test.each([
        ['missing job', undefined],
        ['unknown state', {
            id: 'job-1',
            data,
            getState: vi.fn().mockResolvedValue('unknown'),
        }],
    ])('returns null for a %s', async (_label, job) => {
        queueMocks.getJob.mockResolvedValue(job);
        const client = new BullMQClient(redis, prisma);

        await expect(client.getJob(connectionSpec, 'job-1')).resolves.toBeNull();
    });

    test('reads and parses incremental job logs', async () => {
        queueMocks.getJobLogs.mockResolvedValue({
            logs: [
                JSON.stringify({
                    version: 1,
                    timestamp: '2026-07-28T12:00:00.000Z',
                    level: 'warn',
                    message: 'Repository skipped',
                    attempt: 1,
                }),
            ],
            count: 4,
        });
        const client = new BullMQClient(redis, prisma);

        await expect(client.getJobLogs(connectionSpec, 'job-1', {
            start: 3,
            ascending: true,
        })).resolves.toEqual({
            logs: [{
                version: 1,
                timestamp: '2026-07-28T12:00:00.000Z',
                level: 'warn',
                message: 'Repository skipped',
                attempt: 1,
            }],
            count: 4,
        });
        expect(queueMocks.getJobLogs).toHaveBeenCalledWith(
            'job-1',
            3,
            undefined,
            true,
        );
    });
});
