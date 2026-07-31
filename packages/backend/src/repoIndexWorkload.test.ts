import type { PrismaClient } from '@sourcebot/db';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createRepoIndexWorkload } from './repoIndexWorkload.js';

const repoIndexingJobUpsert = vi.fn();
const repoIndexingJobUpdate = vi.fn();
const repoUpdate = vi.fn();
const transaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({
    repoIndexingJob: {
        upsert: repoIndexingJobUpsert,
        update: repoIndexingJobUpdate,
    },
    repo: {
        update: repoUpdate,
    },
}));

const db = {
    $transaction: transaction,
} as unknown as PrismaClient;

const workload = createRepoIndexWorkload({
    db,
    settings: {
        maxRepoIndexingJobConcurrency: 2,
    } as never,
});

const lifecycleContext = {
    data: {
        repoId: 42,
        type: 'INDEX' as const,
    },
    jobId: 'job-1',
    attemptsMade: 0,
    maxAttempts: 2,
    prisma: db,
};

describe('repoIndexWorkload lifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('declares database-backed lifecycle hooks', () => {
        expect(workload.onStarted).toBeTypeOf('function');
        expect(workload.onCompleted).toBeTypeOf('function');
        expect(workload.onTerminalFailure).toBeTypeOf('function');
    });

    test('marks the repo indexing job and repo as in progress when started', async () => {
        await workload.onStarted?.(lifecycleContext);

        expect(repoIndexingJobUpsert).toHaveBeenCalledWith({
            where: {
                id: 'job-1',
            },
            update: {
                status: 'IN_PROGRESS',
                completedAt: null,
                errorMessage: null,
            },
            create: {
                id: 'job-1',
                repoId: 42,
                type: 'INDEX',
                status: 'IN_PROGRESS',
            },
        });
        expect(repoUpdate).toHaveBeenCalledWith({
            where: {
                id: 42,
            },
            data: {
                latestIndexingJobStatus: 'IN_PROGRESS',
            },
        });
    });

    test('marks the repo indexing job and repo as completed', async () => {
        await workload.onCompleted?.(lifecycleContext, undefined);

        expect(repoIndexingJobUpdate).toHaveBeenCalledWith({
            where: {
                id: 'job-1',
            },
            data: {
                status: 'COMPLETED',
                completedAt: expect.any(Date),
                errorMessage: null,
            },
        });
        expect(repoUpdate).toHaveBeenCalledWith({
            where: {
                id: 42,
            },
            data: {
                latestIndexingJobStatus: 'COMPLETED',
            },
        });
    });

    test('does not update a completed cleanup job after its repo cascades the job row', async () => {
        await workload.onCompleted?.({
            ...lifecycleContext,
            data: {
                repoId: 42,
                type: 'CLEANUP',
            },
        }, undefined);

        expect(transaction).not.toHaveBeenCalled();
    });

    test('marks the repo indexing job and repo as failed after terminal failure', async () => {
        await workload.onTerminalFailure?.(
            lifecycleContext,
            new Error('Unable to clone repository'),
        );

        expect(repoIndexingJobUpdate).toHaveBeenCalledWith({
            where: {
                id: 'job-1',
            },
            data: {
                status: 'FAILED',
                completedAt: expect.any(Date),
                errorMessage: 'Unable to clone repository',
            },
        });
        expect(repoUpdate).toHaveBeenCalledWith({
            where: {
                id: 42,
            },
            data: {
                latestIndexingJobStatus: 'FAILED',
            },
        });
    });
});
