import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    authContext: undefined as unknown,
    enqueue: vi.fn(),
}));

const repoIndexQueue = {
    name: 'repo-index',
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
    JOB_PRIORITIES: { INTERACTIVE: 1 },
    REPO_INDEX_QUEUE: repoIndexQueue,
}));

const { indexRepo } = await import('./actions');

beforeEach(() => {
    vi.clearAllMocks();
    mocks.enqueue.mockResolvedValue('job-1');
});

const setAuthContext = (findFirst: ReturnType<typeof vi.fn>) => {
    mocks.authContext = {
        org: { id: 1 },
        prisma: { repo: { findFirst } },
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
            { repoId: 42, type: 'INDEX' },
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
