import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    authContext: undefined as unknown,
    getEntitlements: vi.fn(),
}));

vi.mock('@/middleware/withAuth', () => ({
    withAuth: vi.fn((callback: (context: unknown) => unknown) => callback(mocks.authContext)),
}));

vi.mock('@/lib/entitlements', () => ({
    getEntitlements: mocks.getEntitlements,
}));

vi.mock('@sourcebot/shared', () => ({
    createLogger: () => ({ error: vi.fn() }),
    env: { PERMISSION_SYNC_ENABLED: 'true' },
    PERMISSION_SYNC_SUPPORTED_IDENTITY_PROVIDERS: [
        'github',
        'gitlab',
        'bitbucket-cloud',
        'bitbucket-server',
    ],
}));

const { getPermissionSyncStatus } = await import('./api');

beforeEach(() => {
    vi.clearAllMocks();
    mocks.getEntitlements.mockResolvedValue(['permission-syncing']);
});

describe('getPermissionSyncStatus', () => {
    test('returns pending first-sync state and structured account issues for the authenticated user', async () => {
        const findMany = vi.fn().mockResolvedValue([
            {
                id: 'account_pending',
                providerId: 'github',
                providerType: 'github',
                permissionSyncedAt: null,
                permissionSyncIssue: null,
                permissionSyncIssueAt: null,
                permissionSyncJobs: [{ status: 'PENDING' }],
            },
            {
                id: 'account_action_required',
                providerId: 'bitbucket-server-corp',
                providerType: 'bitbucket-server',
                permissionSyncedAt: new Date('2026-07-01T00:00:00Z'),
                permissionSyncIssue: 'REAUTHENTICATION_REQUIRED',
                permissionSyncIssueAt: new Date('2026-07-22T12:00:00Z'),
                permissionSyncJobs: [{ status: 'FAILED' }],
            },
        ]);
        mocks.authContext = {
            user: { id: 'user_1' },
            prisma: { account: { findMany } },
        };

        await expect(getPermissionSyncStatus()).resolves.toEqual({
            hasPendingFirstSync: true,
            issues: [{
                accountId: 'account_action_required',
                providerId: 'bitbucket-server-corp',
                providerType: 'bitbucket-server',
                reason: 'REAUTHENTICATION_REQUIRED',
                occurredAt: '2026-07-22T12:00:00.000Z',
            }],
        });
        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ userId: 'user_1' }),
        }));
    });

    test('returns an issue even when the account has no issue timestamp', async () => {
        mocks.authContext = {
            user: { id: 'user_1' },
            prisma: {
                account: {
                    findMany: vi.fn().mockResolvedValue([{
                        id: 'account_1',
                        providerId: 'gitlab',
                        providerType: 'gitlab',
                        permissionSyncedAt: new Date('2026-07-01T00:00:00Z'),
                        permissionSyncIssue: 'INSUFFICIENT_SCOPE',
                        permissionSyncIssueAt: null,
                        permissionSyncJobs: [{ status: 'FAILED' }],
                    }]),
                },
            },
        };

        await expect(getPermissionSyncStatus()).resolves.toMatchObject({
            issues: [{ reason: 'INSUFFICIENT_SCOPE', occurredAt: null }],
        });
    });
});
