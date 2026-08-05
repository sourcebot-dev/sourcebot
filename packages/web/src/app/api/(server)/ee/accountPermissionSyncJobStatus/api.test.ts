import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    authContext: undefined as unknown,
}));

vi.mock('@/middleware/withAuth', () => ({
    withAuth: vi.fn((callback: (context: unknown) => unknown) => callback(mocks.authContext)),
}));

vi.mock('@sourcebot/shared', () => ({
    createLogger: () => ({ error: vi.fn() }),
}));

const { getAccountSyncStatus } = await import('./api');

beforeEach(() => {
    vi.clearAllMocks();
});

describe('getAccountSyncStatus', () => {
    test.each(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'] as const)(
        'returns the underlying %s job status',
        async (status) => {
            const findFirst = vi.fn().mockResolvedValue({ status });
            mocks.authContext = {
                user: { id: 'user_1' },
                prisma: { accountPermissionSyncJob: { findFirst } },
            };

            await expect(getAccountSyncStatus('job_1')).resolves.toEqual({ status });
            expect(findFirst).toHaveBeenCalledWith({
                where: {
                    id: 'job_1',
                    account: { userId: 'user_1' },
                },
            });
        },
    );
});
