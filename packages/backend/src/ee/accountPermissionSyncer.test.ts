import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    hasEntitlement: vi.fn(),
}));

vi.mock('../entitlements.js', () => ({
    hasEntitlement: mocks.hasEntitlement,
}));

import { AccountPermissionSyncer, classifyPermissionSyncFailure } from './accountPermissionSyncer.js';
import {
    PermissionSyncUpstreamError,
    type PermissionSyncUpstreamErrorKind,
} from './permissionSyncError.js';
import { TokenRefreshError, type TokenRefreshErrorKind } from './tokenRefresh.js';

const tokenRefreshError = (
    kind: TokenRefreshErrorKind,
    status?: number,
): TokenRefreshError => new TokenRefreshError(`Token refresh failed: ${kind}`, {
    kind,
    status,
});

const upstreamError = (
    kind: PermissionSyncUpstreamErrorKind,
): PermissionSyncUpstreamError => new PermissionSyncUpstreamError(`Permission sync failed: ${kind}`, {
    kind,
    provider: 'github',
    operation: 'list_accessible_repositories',
});

const createSyncerHarness = (syncError?: Error, permissionCount = 95) => {
    const account = {
        id: 'account_1',
        providerId: 'bitbucket-server',
        user: { email: 'user@example.com' },
    };
    const db = {
        accountPermissionSyncJob: {
            update: vi.fn().mockResolvedValue({ account }),
        },
        accountToRepoPermission: {
            deleteMany: vi.fn().mockResolvedValue({ count: permissionCount }),
        },
        account: {
            update: vi.fn().mockResolvedValue(account),
        },
        $transaction: vi.fn((queries: Array<Promise<unknown>>) => Promise.all(queries)),
    };
    const syncAccountPermissions = syncError
        ? vi.fn().mockRejectedValue(syncError)
        : vi.fn().mockResolvedValue(undefined);
    const syncer = Object.create(AccountPermissionSyncer.prototype) as {
        db: typeof db;
        syncAccountPermissions: typeof syncAccountPermissions;
        runJob(job: { data: { jobId: string } }): Promise<void>;
        onJobCompleted(job: { data: { jobId: string } }): Promise<void>;
    };
    syncer.db = db;
    syncer.syncAccountPermissions = syncAccountPermissions;

    return {
        account,
        db,
        job: { data: { jobId: 'job_1' } },
        syncer,
    };
};

beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasEntitlement.mockResolvedValue(true);
});

describe('classifyPermissionSyncFailure', () => {
    test('fails closed when the refresh token is rejected', () => {
        expect(classifyPermissionSyncFailure(tokenRefreshError('refresh_token_rejected', 400))).toEqual({
            action: 'clear_permissions',
            reason: 'oauth_refresh_token_rejected',
        });
    });

    test.each([
        ['transient', 500],
        ['configuration', 400],
        ['invalid_response', undefined],
        ['local_credential', undefined],
    ] satisfies Array<[TokenRefreshErrorKind, number | undefined]>)('keeps permissions for a %s token refresh failure', (kind, status) => {
        expect(classifyPermissionSyncFailure(tokenRefreshError(kind, status))).toEqual({
            action: 'preserve_permissions',
        });
    });

    test('does not treat a token refresh configuration error with HTTP 401 as an API authorization failure', () => {
        expect(classifyPermissionSyncFailure(tokenRefreshError('configuration', 401))).toEqual({
            action: 'preserve_permissions',
        });
    });

    test.each([
        ['credential_rejected', 'upstream_credential_rejected'],
        ['insufficient_scope', 'upstream_insufficient_scope'],
    ] as const)('fails closed for a classified %s upstream failure', (kind, reason) => {
        expect(classifyPermissionSyncFailure(upstreamError(kind))).toEqual({
            action: 'clear_permissions',
            reason,
        });
    });

    test.each([
        'rate_limited',
        'upstream_unavailable',
        'forbidden',
        'unknown',
    ] satisfies PermissionSyncUpstreamErrorKind[])('keeps permissions for a classified %s upstream failure', (kind) => {
        expect(classifyPermissionSyncFailure(upstreamError(kind))).toEqual({
            action: 'preserve_permissions',
        });
    });

    test.each([401, 403, 410])('does not fail closed on an unclassified HTTP %s error', (status) => {
        const error = Object.assign(new Error(`HTTP ${status}`), { status });
        expect(classifyPermissionSyncFailure(error)).toEqual({
            action: 'preserve_permissions',
        });
    });
});

describe('permission sync issue lifecycle', () => {
    test('atomically records a reauthentication issue when invalid_grant clears permissions', async () => {
        const error = tokenRefreshError('invalid_grant', 400);
        const { db, job, syncer } = createSyncerHarness(error);

        await expect(syncer.runJob(job)).rejects.toBe(error);

        expect(db.accountToRepoPermission.deleteMany).toHaveBeenCalledWith({
            where: { accountId: 'account_1' },
        });
        expect(db.account.update).toHaveBeenCalledWith({
            where: { id: 'account_1' },
            data: {
                permissionSyncIssue: 'REAUTHENTICATION_REQUIRED',
                permissionSyncIssueAt: expect.any(Date),
            },
        });
        expect(db.$transaction).toHaveBeenCalledOnce();
    });

    test('records an issue when permissions were already cleared by an earlier attempt', async () => {
        const error = tokenRefreshError('invalid_grant', 400);
        const { db, job, syncer } = createSyncerHarness(error, 0);

        await expect(syncer.runJob(job)).rejects.toBe(error);

        expect(db.account.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                permissionSyncIssue: 'REAUTHENTICATION_REQUIRED',
            }),
        }));
        expect(db.$transaction).toHaveBeenCalledOnce();
    });

    test('records an insufficient-scope issue for scope failures', async () => {
        const error = upstreamError('insufficient_scope');
        const { db, job, syncer } = createSyncerHarness(error);

        await expect(syncer.runJob(job)).rejects.toBe(error);

        expect(db.account.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                permissionSyncIssue: 'INSUFFICIENT_SCOPE',
            }),
        }));
    });

    test('does not record an issue or clear permissions for a transient refresh failure', async () => {
        const error = tokenRefreshError('transient', 500);
        const { db, job, syncer } = createSyncerHarness(error);

        await expect(syncer.runJob(job)).rejects.toBe(error);

        expect(db.accountToRepoPermission.deleteMany).not.toHaveBeenCalled();
        expect(db.account.update).not.toHaveBeenCalled();
        expect(db.$transaction).not.toHaveBeenCalled();
    });

    test('clears the action-required issue after a successful permission sync', async () => {
        const { db, job, syncer } = createSyncerHarness();

        await syncer.onJobCompleted(job);

        expect(db.accountPermissionSyncJob.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                account: {
                    update: expect.objectContaining({
                        permissionSyncIssue: null,
                        permissionSyncIssueAt: null,
                    }),
                },
            }),
        }));
    });
});
