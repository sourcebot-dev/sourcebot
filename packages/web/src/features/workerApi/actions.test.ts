import { ConnectionSyncJobStatus, OrgRole } from '@sourcebot/db';
import type { DataOf, QueueSpec } from '@sourcebot/shared';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    connectionFindUnique: vi.fn(),
    connectionSyncJobCreateMany: vi.fn(),
    enqueue: vi.fn(),
}));

vi.mock('@/middleware/sew', () => ({
    sew: (fn: () => Promise<unknown>) => fn(),
}));

vi.mock('@/middleware/withAuth', () => ({
    withAuth: (fn: (context: unknown) => Promise<unknown>) => fn({
        org: { id: 7 },
        prisma: {
            connection: {
                findUnique: mocks.connectionFindUnique,
            },
            connectionSyncJob: {
                createMany: mocks.connectionSyncJobCreateMany,
            },
        },
        role: 'OWNER',
    }),
    withOptionalAuth: vi.fn(),
}));

vi.mock('@/middleware/withMinimumOrgRole', () => ({
    withMinimumOrgRole: (
        _role: OrgRole,
        _minimumRole: OrgRole,
        fn: () => Promise<unknown>,
    ) => fn(),
}));

vi.mock('@/lib/jobProducer', () => ({
    getJobProducer: () => ({
        enqueue: mocks.enqueue,
    }),
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
    env: {
        WORKER_API_URL: 'http://localhost:3060',
    },
}));

import { syncConnection } from './actions';

describe('syncConnection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.connectionSyncJobCreateMany.mockResolvedValue({ count: 1 });
        mocks.enqueue.mockImplementation(async (
            spec: QueueSpec<'connection'>,
            data: DataOf<'connection'>,
        ) => {
            const jobId = 'job-1';
            await spec.onEnqueued?.({
                data,
                jobId,
                attemptsMade: 0,
                maxAttempts: spec.jobOptions.attempts,
            });
            return jobId;
        });
    });

    test('enqueues an org-scoped connection sync and creates its pending job record', async () => {
        mocks.connectionFindUnique.mockResolvedValue({
            id: 42,
            orgId: 7,
        });

        const result = await syncConnection(42);

        expect(mocks.connectionFindUnique).toHaveBeenCalledWith({
            where: {
                id: 42,
                orgId: 7,
            },
            select: {
                id: true,
                orgId: true,
            },
        });
        expect(mocks.enqueue).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'connection',
                onEnqueued: expect.any(Function),
            }),
            {
                connectionId: 42,
                orgId: 7,
            },
        );
        expect(mocks.connectionSyncJobCreateMany).toHaveBeenCalledWith({
            data: [{
                id: 'job-1',
                connectionId: 42,
                status: ConnectionSyncJobStatus.PENDING,
                warningMessages: [],
            }],
            skipDuplicates: true,
        });
        expect(result).toEqual({ jobId: 'job-1' });
    });

    test('does not enqueue a missing connection', async () => {
        mocks.connectionFindUnique.mockResolvedValue(null);

        const result = await syncConnection(42);

        expect(mocks.enqueue).not.toHaveBeenCalled();
        expect(result).toEqual(expect.objectContaining({
            statusCode: 404,
            message: 'Connection not found',
        }));
    });
});
