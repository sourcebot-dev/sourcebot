import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    authContext: undefined as unknown,
    getEntitlements: vi.fn(),
    getJobs: vi.fn(),
}));

vi.mock('@/middleware/withAuth', () => ({
    withAuth: vi.fn((callback: (context: unknown) => unknown) => callback(mocks.authContext)),
}));

vi.mock('@/lib/entitlements', () => ({
    getEntitlements: mocks.getEntitlements,
}));

vi.mock('@/lib/bullmqClient', () => ({
    getBullMQClient: () => ({ getJobs: mocks.getJobs }),
}));

vi.mock('@sourcebot/shared', () => ({
    createLogger: () => ({ error: vi.fn() }),
    ACCOUNT_PERMISSION_SYNC_QUEUE: { name: 'account-permission-sync' },
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
    mocks.getJobs.mockResolvedValue(new Map());
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
                latestPermissionSyncJobId: 'job_pending',
            },
            {
                id: 'account_action_required',
                providerId: 'bitbucket-server-corp',
                providerType: 'bitbucket-server',
                permissionSyncedAt: new Date('2026-07-01T00:00:00Z'),
                permissionSyncIssue: 'REAUTHENTICATION_REQUIRED',
                permissionSyncIssueAt: new Date('2026-07-22T12:00:00Z'),
                latestPermissionSyncJobId: 'job_recovery',
            },
        ]);
        mocks.getJobs.mockResolvedValue(new Map([
            ['job_pending', {
                id: 'job_pending',
                data: { accountId: 'account_pending' },
                status: 'PENDING',
                errorMessage: null,
            }],
            ['job_recovery', {
                id: 'job_recovery',
                data: { accountId: 'account_action_required' },
                status: 'IN_PROGRESS',
                errorMessage: null,
            }],
        ]));
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
                isSyncing: true,
            }],
        });
        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ userId: 'user_1' }),
        }));
        expect(mocks.getJobs).toHaveBeenCalledWith(
            { name: 'account-permission-sync' },
            ['job_pending', 'job_recovery'],
        );
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
                        latestPermissionSyncJobId: 'job_failed',
                    }]),
                },
            },
        };
        mocks.getJobs.mockResolvedValue(new Map([['job_failed', {
            id: 'job_failed',
            data: { accountId: 'account_1' },
            status: 'FAILED',
            errorMessage: 'Insufficient scope',
        }]]));

        await expect(getPermissionSyncStatus()).resolves.toMatchObject({
            issues: [{ reason: 'INSUFFICIENT_SCOPE', occurredAt: null, isSyncing: false }],
        });
    });

    test('treats a missing first-sync job as pending', async () => {
        mocks.authContext = {
            user: { id: 'user_1' },
            prisma: {
                account: {
                    findMany: vi.fn().mockResolvedValue([{
                        id: 'account_1',
                        providerId: 'github',
                        providerType: 'github',
                        permissionSyncedAt: null,
                        permissionSyncIssue: null,
                        permissionSyncIssueAt: null,
                        latestPermissionSyncJobId: null,
                    }]),
                },
            },
        };

        await expect(getPermissionSyncStatus()).resolves.toMatchObject({
            hasPendingFirstSync: true,
        });
        expect(mocks.getJobs).not.toHaveBeenCalled();
    });
});
