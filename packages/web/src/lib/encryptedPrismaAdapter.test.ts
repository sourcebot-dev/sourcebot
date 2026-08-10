import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    removeAccountPermissionSyncScheduler: vi.fn(),
}));

vi.mock('@auth/prisma-adapter', () => ({
    PrismaAdapter: () => ({}),
}));
vi.mock('@sourcebot/shared', () => ({
    encryptOAuthToken: (value: unknown) => value,
    getIdentityProviderConfig: vi.fn(),
}));
vi.mock('@/ee/features/permissionSync/accountPermissionSyncQueue.server', () => ({
    removeAccountPermissionSyncScheduler:
        mocks.removeAccountPermissionSyncScheduler,
}));

const { EncryptedPrismaAdapter } = await import('./encryptedPrismaAdapter');

beforeEach(() => {
    vi.clearAllMocks();
    mocks.removeAccountPermissionSyncScheduler.mockResolvedValue(true);
});

describe('EncryptedPrismaAdapter.unlinkAccount', () => {
    test('removes the scheduler before deleting the account', async () => {
        const findUnique = vi.fn().mockResolvedValue({ id: 'account-1' });
        const deleteAccount = vi.fn().mockResolvedValue({});
        const adapter = EncryptedPrismaAdapter({
            account: {
                delete: deleteAccount,
                findUnique,
            },
        } as never);

        await adapter.unlinkAccount?.({
            provider: 'github',
            providerAccountId: 'github-user-1',
        });

        const where = {
            providerId_providerAccountId: {
                providerId: 'github',
                providerAccountId: 'github-user-1',
            },
        };
        expect(findUnique).toHaveBeenCalledWith({
            where,
            select: { id: true },
        });
        expect(mocks.removeAccountPermissionSyncScheduler).toHaveBeenCalledWith(
            'account-1',
        );
        expect(deleteAccount).toHaveBeenCalledWith({ where });
        expect(
            mocks.removeAccountPermissionSyncScheduler.mock.invocationCallOrder[0],
        ).toBeLessThan(deleteAccount.mock.invocationCallOrder[0]);
    });

    test('does not delete the account when scheduler removal fails', async () => {
        const deleteAccount = vi.fn();
        const adapter = EncryptedPrismaAdapter({
            account: {
                delete: deleteAccount,
                findUnique: vi.fn().mockResolvedValue({ id: 'account-1' }),
            },
        } as never);
        mocks.removeAccountPermissionSyncScheduler.mockRejectedValue(
            new Error('Redis unavailable'),
        );

        await expect(adapter.unlinkAccount?.({
            provider: 'github',
            providerAccountId: 'github-user-1',
        })).rejects.toThrow('Redis unavailable');
        expect(deleteAccount).not.toHaveBeenCalled();
    });
});
