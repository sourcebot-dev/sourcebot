import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    authContext: undefined as unknown,
    getJob: vi.fn(),
}));

vi.mock('@/middleware/withAuth', () => ({
    withAuth: vi.fn((callback: (context: unknown) => unknown) => callback(mocks.authContext)),
}));

vi.mock('@/lib/bullmqClient', () => ({
    getBullMQClient: () => ({ getJob: mocks.getJob }),
}));

vi.mock('@sourcebot/shared', () => ({
    ACCOUNT_PERMISSION_SYNC_QUEUE: { name: 'account-permission-sync' },
    createLogger: () => ({ error: vi.fn() }),
}));

const { getAccountSyncStatus } = await import('./api');

beforeEach(() => {
    vi.clearAllMocks();
    mocks.getJob.mockReset();
});

describe('getAccountSyncStatus', () => {
    test.each(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'] as const)(
        'returns the underlying %s job status',
        async (status) => {
            const findFirst = vi.fn().mockResolvedValue({ id: 'account_1' });
            mocks.getJob.mockResolvedValue({
                id: 'job_1',
                data: { accountId: 'account_1' },
                status,
                errorMessage: null,
            });
            mocks.authContext = {
                user: { id: 'user_1' },
                prisma: { account: { findFirst } },
            };

            await expect(getAccountSyncStatus('job_1')).resolves.toEqual({ status });
            expect(mocks.getJob).toHaveBeenCalledWith(
                { name: 'account-permission-sync' },
                'job_1',
            );
            expect(findFirst).toHaveBeenCalledWith({
                where: {
                    id: 'account_1',
                    userId: 'user_1',
                },
                select: { id: true },
            });
        },
    );

    test('does not expose a job belonging to another user', async () => {
        mocks.getJob.mockResolvedValue({
            id: 'job_1',
            data: { accountId: 'account_1' },
            status: 'IN_PROGRESS',
            errorMessage: null,
        });
        mocks.authContext = {
            user: { id: 'user_1' },
            prisma: {
                account: { findFirst: vi.fn().mockResolvedValue(null) },
            },
        };

        await expect(getAccountSyncStatus('job_1')).resolves.toMatchObject({
            statusCode: 404,
        });
    });

    test('returns not found when Redis no longer has the job', async () => {
        const findFirst = vi.fn();
        mocks.getJob.mockResolvedValue(null);
        mocks.authContext = {
            user: { id: 'user_1' },
            prisma: { account: { findFirst } },
        };

        await expect(getAccountSyncStatus('missing')).resolves.toMatchObject({
            statusCode: 404,
        });
        expect(findFirst).not.toHaveBeenCalled();
    });
});
