import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    authContext: undefined as unknown,
    enqueue: vi.fn(),
    getFailedJobIds: vi.fn(),
}));

const repoIndexQueue = {
    name: 'repo-index',
};

vi.mock('@/lib/bullmqClient', () => ({
    getBullMQClient: () => ({
        enqueue: mocks.enqueue,
        getFailedJobIds: mocks.getFailedJobIds,
    }),
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
    JOB_PRIORITIES: { INTERACTIVE: 1 },
    REPO_INDEX_QUEUE: repoIndexQueue,
}));

const { indexRepo, retryReposWithSyncIssues } = await import('./actions');

beforeEach(() => {
    vi.clearAllMocks();
    mocks.enqueue.mockResolvedValue('job-1');
    mocks.getFailedJobIds.mockResolvedValue([]);
});

const setAuthContext = (
    findFirst: ReturnType<typeof vi.fn>,
    findMany = vi.fn().mockResolvedValue([]),
) => {
    mocks.authContext = {
        org: { id: 1 },
        prisma: { repo: { findFirst, findMany } },
        role: 'OWNER',
    };
};

describe('indexRepo', () => {
    test('enqueues an interactive index job for an existing repo', async () => {
        const findFirst = vi.fn().mockResolvedValue({ id: 42 });
        setAuthContext(findFirst);

        await expect(indexRepo(42)).resolves.toEqual({ jobId: 'job-1' });

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
            repoIndexQueue,
            { repoId: 42 },
            { priority: 1 },
        );
    });

    test('does not enqueue an index job for a missing repo', async () => {
        setAuthContext(vi.fn().mockResolvedValue(null));

        await expect(indexRepo(42)).resolves.toEqual({
            error: 'Failed to index repo',
        });
        expect(mocks.enqueue).not.toHaveBeenCalled();
    });

    test('returns a service error when Redis rejects the job', async () => {
        setAuthContext(vi.fn().mockResolvedValue({ id: 42 }));
        mocks.enqueue.mockRejectedValue(new Error('Redis unavailable'));

        await expect(indexRepo(42)).resolves.toEqual({
            error: 'Failed to index repo',
        });
    });
});

describe('retryReposWithSyncIssues', () => {
    test('retries every repository whose latest job failed', async () => {
        const findMany = vi.fn().mockResolvedValue([{ id: 10 }, { id: 20 }]);
        setAuthContext(vi.fn(), findMany);
        mocks.getFailedJobIds.mockResolvedValue(['failed-1', 'failed-2']);
        mocks.enqueue
            .mockResolvedValueOnce('retry-10')
            .mockResolvedValueOnce('retry-20');

        await expect(retryReposWithSyncIssues()).resolves.toEqual({
            jobs: [
                { repoId: 10, jobId: 'retry-10' },
                { repoId: 20, jobId: 'retry-20' },
            ],
            failedCount: 0,
        });

        expect(findMany).toHaveBeenCalledWith({
            where: {
                orgId: 1,
                latestIndexingJobId: { in: ['failed-1', 'failed-2'] },
            },
            orderBy: { id: 'asc' },
            select: { id: true },
        });
        expect(mocks.enqueue).toHaveBeenNthCalledWith(
            1,
            repoIndexQueue,
            { repoId: 10 },
            { priority: 1 },
        );
        expect(mocks.enqueue).toHaveBeenNthCalledWith(
            2,
            repoIndexQueue,
            { repoId: 20 },
            { priority: 1 },
        );
    });

    test('returns successful jobs when part of the batch fails', async () => {
        const findMany = vi.fn().mockResolvedValue([{ id: 10 }, { id: 20 }]);
        setAuthContext(vi.fn(), findMany);
        mocks.getFailedJobIds.mockResolvedValue(['failed-1']);
        mocks.enqueue
            .mockResolvedValueOnce('retry-10')
            .mockRejectedValueOnce(new Error('Redis unavailable'));

        await expect(retryReposWithSyncIssues()).resolves.toEqual({
            jobs: [{ repoId: 10, jobId: 'retry-10' }],
            failedCount: 1,
        });
    });
});
