import { describe, expect, test } from 'vitest';
import { classifyPermissionSyncFailure } from './accountPermissionSyncer.js';
import { TokenRefreshError, type TokenRefreshErrorKind } from './tokenRefresh.js';

const tokenRefreshError = (
    kind: TokenRefreshErrorKind,
    status?: number,
): TokenRefreshError => new TokenRefreshError(`Token refresh failed: ${kind}`, {
    kind,
    status,
});

describe('classifyPermissionSyncFailure', () => {
    test('fails closed for invalid_grant', () => {
        expect(classifyPermissionSyncFailure(tokenRefreshError('invalid_grant', 400))).toEqual({
            action: 'clear_permissions',
            reason: 'oauth_invalid_grant',
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
        [401, 'http_unauthorized'],
        [403, 'http_forbidden'],
        [410, 'http_gone'],
    ] as const)('preserves fail-closed behavior for an API HTTP %s response', (status, reason) => {
        const error = Object.assign(new Error(reason), { status });
        expect(classifyPermissionSyncFailure(error)).toEqual({
            action: 'clear_permissions',
            reason,
        });
    });

    test('keeps permissions for an unrelated API failure', () => {
        const error = Object.assign(new Error('Internal Server Error'), { status: 500 });
        expect(classifyPermissionSyncFailure(error)).toEqual({
            action: 'preserve_permissions',
        });
    });
});
