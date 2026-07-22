import { describe, expect, test } from 'vitest';
import { classifyPermissionSyncFailure } from './accountPermissionSyncer.js';
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
        ['permission_endpoint_removed', 'permission_endpoint_removed'],
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
