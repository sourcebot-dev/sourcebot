import { beforeEach, describe, expect, test, vi } from 'vitest';
import { OPTIONAL_PROVIDERS_LINK_SKIPPED_COOKIE_NAME } from '@/lib/constants';

const mocks = vi.hoisted(() => ({
    authContext: undefined as unknown,
    hasEntitlement: vi.fn(),
    removeAccountPermissionSyncScheduler: vi.fn(),
    scheduleAndTriggerAccountPermissionSync: vi.fn(),
    cookieGet: vi.fn(),
    cookieSet: vi.fn(),
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
vi.mock('@/ee/features/permissionSync/accountPermissionSyncQueue.server', () => ({
    removeAccountPermissionSyncScheduler:
        mocks.removeAccountPermissionSyncScheduler,
    scheduleAndTriggerAccountPermissionSync:
        mocks.scheduleAndTriggerAccountPermissionSync,
}));
vi.mock('@/lib/entitlements', () => ({
    hasEntitlement: mocks.hasEntitlement,
}));
vi.mock('@/lib/serviceError', () => ({
    unexpectedError: (message: string) => ({ error: message }),
}));
vi.mock('@sourcebot/shared', () => ({
    createLogger: () => ({ info: vi.fn() }),
    doesIdpSupportPermissionSyncing: () => true,
    env: { PERMISSION_SYNC_ENABLED: 'true' },
    getIdentityProviderConfig: vi.fn(),
    getIdentityProviderConfigs: vi.fn(),
}));
vi.mock('next/headers', () => ({
    cookies: async () => ({ get: mocks.cookieGet, set: mocks.cookieSet }),
}));

const {
    skipOptionalProvidersLink,
    triggerAccountPermissionSync,
    unlinkLinkedAccountProvider,
} = await import('./actions');

beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookieGet.mockReturnValue(undefined);
    mocks.hasEntitlement.mockResolvedValue(true);
    mocks.removeAccountPermissionSyncScheduler.mockResolvedValue(true);
    mocks.scheduleAndTriggerAccountPermissionSync.mockResolvedValue({
        jobId: 'job-1',
    });
});

describe('skipOptionalProvidersLink', () => {
    test('stores the offered provider IDs and retains previous dismissals without duplicates', async () => {
        mocks.cookieGet.mockReturnValue({ value: JSON.stringify(['github-personal']) });
        await expect(skipOptionalProvidersLink(['github-personal', 'github-work'])).resolves.toBe(true);
        expect(mocks.cookieSet).toHaveBeenCalledWith(
            OPTIONAL_PROVIDERS_LINK_SKIPPED_COOKIE_NAME,
            JSON.stringify(['github-personal', 'github-work']),
            expect.objectContaining({ path: '/', maxAge: 365 * 24 * 60 * 60 }),
        );
    });

    test('replaces the legacy blanket dismissal with just the offered IDs', async () => {
        mocks.cookieGet.mockReturnValue({ value: 'true' });
        await skipOptionalProvidersLink(['github-personal']);
        expect(mocks.cookieSet).toHaveBeenCalledWith(
            OPTIONAL_PROVIDERS_LINK_SKIPPED_COOKIE_NAME,
            JSON.stringify(['github-personal']),
            expect.any(Object),
        );
    });
});

describe('triggerAccountPermissionSync', () => {
    test('enqueues a sync for an eligible account owned by the user', async () => {
        const findFirst = vi.fn().mockResolvedValue({ providerType: 'github' });
        mocks.authContext = {
            prisma: { account: { findFirst } },
            role: 'MEMBER',
            user: { id: 'user-1' },
        };

        await expect(
            triggerAccountPermissionSync('account-1'),
        ).resolves.toEqual({ jobId: 'job-1' });

        expect(findFirst).toHaveBeenCalledWith({
            where: {
                id: 'account-1',
                userId: 'user-1',
            },
            select: {
                providerType: true,
            },
        });
        expect(
            mocks.scheduleAndTriggerAccountPermissionSync,
        ).toHaveBeenCalledWith('account-1');
    });

    test('does not enqueue a sync for an account the user does not own', async () => {
        mocks.authContext = {
            prisma: {
                account: { findFirst: vi.fn().mockResolvedValue(null) },
            },
            role: 'MEMBER',
            user: { id: 'user-1' },
        };

        await expect(
            triggerAccountPermissionSync('account-2'),
        ).resolves.toEqual({
            error: 'Account does not support permission syncing',
        });
        expect(
            mocks.scheduleAndTriggerAccountPermissionSync,
        ).not.toHaveBeenCalled();
    });
});

describe('unlinkLinkedAccountProvider', () => {
    test('removes account schedulers before deleting the accounts', async () => {
        const findMany = vi.fn().mockResolvedValue([
            { id: 'account-1' },
            { id: 'account-2' },
        ]);
        const deleteMany = vi.fn().mockResolvedValue({ count: 2 });
        mocks.authContext = {
            prisma: { account: { deleteMany, findMany } },
            role: 'MEMBER',
            user: { id: 'user-1' },
        };

        await expect(
            unlinkLinkedAccountProvider('github'),
        ).resolves.toEqual({ success: true, count: 2 });

        const where = { providerId: 'github', userId: 'user-1' };
        expect(findMany).toHaveBeenCalledWith({
            where,
            select: { id: true },
        });
        expect(mocks.removeAccountPermissionSyncScheduler).toHaveBeenCalledTimes(2);
        expect(mocks.removeAccountPermissionSyncScheduler).toHaveBeenCalledWith('account-1');
        expect(mocks.removeAccountPermissionSyncScheduler).toHaveBeenCalledWith('account-2');
        expect(deleteMany).toHaveBeenCalledWith({ where });
        expect(
            mocks.removeAccountPermissionSyncScheduler.mock.invocationCallOrder[1],
        ).toBeLessThan(deleteMany.mock.invocationCallOrder[0]);
    });

    test('does not delete accounts when scheduler removal fails', async () => {
        const findMany = vi.fn().mockResolvedValue([{ id: 'account-1' }]);
        const deleteMany = vi.fn();
        mocks.authContext = {
            prisma: { account: { deleteMany, findMany } },
            role: 'MEMBER',
            user: { id: 'user-1' },
        };
        mocks.removeAccountPermissionSyncScheduler.mockRejectedValue(
            new Error('Redis unavailable'),
        );

        await expect(
            unlinkLinkedAccountProvider('github'),
        ).rejects.toThrow('Redis unavailable');
        expect(deleteMany).not.toHaveBeenCalled();
    });
});
