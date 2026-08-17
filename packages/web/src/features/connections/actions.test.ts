import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    authContext: undefined as unknown,
    enqueue: vi.fn(),
}));

const connectionQueue = {
    name: 'connection-sync',
};

vi.mock('@/lib/bullmqClient', () => ({
    getBullMQClient: () => ({ enqueue: mocks.enqueue }),
}));
vi.mock('@/lib/serviceError', () => ({
    unexpectedError: (message: string) => ({ error: message }),
}));
vi.mock('@/middleware/sew', () => ({
    sew: (callback: () => unknown) => callback(),
}));
vi.mock('@/middleware/withAuth', () => ({
    withAuth: (callback: (context: unknown) => unknown) =>
        callback(mocks.authContext),
}));
vi.mock('@/middleware/withMinimumOrgRole', () => ({
    withMinimumOrgRole: (
        _role: unknown,
        _minimumRole: unknown,
        callback: () => unknown,
    ) => callback(),
}));
vi.mock('@sourcebot/shared', () => ({
    CONNECTION_QUEUE: connectionQueue,
    JOB_PRIORITIES: { INTERACTIVE: 1 },
}));

const { syncConnection } = await import('./actions');

beforeEach(() => {
    vi.clearAllMocks();
    mocks.enqueue.mockResolvedValue('job-1');
});

const setAuthContext = (findFirst: ReturnType<typeof vi.fn>) => {
    mocks.authContext = {
        org: { id: 1 },
        prisma: { connection: { findFirst } },
        role: 'OWNER',
    };
};

describe('syncConnection', () => {
    test('enqueues an interactive sync for an existing connection', async () => {
        const findFirst = vi.fn().mockResolvedValue({ id: 42 });
        setAuthContext(findFirst);

        await expect(syncConnection(42)).resolves.toEqual({ jobId: 'job-1' });

        expect(findFirst).toHaveBeenCalledWith({
            where: {
                id: 42,
                orgId: 1,
            },
            select: {
                id: true,
            },
        });
        expect(mocks.enqueue).toHaveBeenCalledWith(
            connectionQueue,
            { connectionId: 42 },
            { priority: 1 },
        );
    });

    test('does not enqueue a sync for a missing connection', async () => {
        setAuthContext(vi.fn().mockResolvedValue(null));

        await expect(syncConnection(42)).resolves.toEqual({
            error: 'Failed to sync connection',
        });
        expect(mocks.enqueue).not.toHaveBeenCalled();
    });

    test('returns a service error when Redis rejects the job', async () => {
        setAuthContext(vi.fn().mockResolvedValue({ id: 42 }));
        mocks.enqueue.mockRejectedValue(new Error('Redis unavailable'));

        await expect(syncConnection(42)).resolves.toEqual({
            error: 'Failed to sync connection',
        });
    });
});
