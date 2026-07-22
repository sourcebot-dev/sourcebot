import { describe, expect, test } from 'vitest';
import {
    classifyPermissionSyncUpstreamError,
    PermissionSyncUpstreamError,
    withPermissionSyncUpstreamError,
} from './permissionSyncError.js';

describe('classifyPermissionSyncUpstreamError', () => {
    test('classifies a 401 from an authenticated operation as a credential rejection', () => {
        const cause = Object.assign(new Error('Unauthorized'), { status: 401 });

        expect(classifyPermissionSyncUpstreamError(
            cause,
            'bitbucket-server',
            'list_accessible_repositories',
        )).toMatchObject({
            kind: 'credential_rejected',
            provider: 'bitbucket-server',
            operation: 'list_accessible_repositories',
            status: 401,
            cause,
        });
    });

    test('classifies a GitHub rate-limit 403 separately from an ambiguous forbidden response', () => {
        const rateLimitError = Object.assign(new Error('Rate limited'), {
            status: 403,
            response: { headers: { 'x-ratelimit-remaining': '0' } },
        });
        const forbiddenError = Object.assign(new Error('Forbidden'), { status: 403 });

        expect(classifyPermissionSyncUpstreamError(
            rateLimitError,
            'github',
            'list_accessible_repositories',
        ).kind).toBe('rate_limited');
        expect(classifyPermissionSyncUpstreamError(
            forbiddenError,
            'github',
            'list_accessible_repositories',
        ).kind).toBe('forbidden');
    });

    test('classifies HTTP 429 as rate limited', () => {
        const cause = Object.assign(new Error('Too Many Requests'), { status: 429 });

        expect(classifyPermissionSyncUpstreamError(
            cause,
            'gitlab',
            'list_accessible_repositories',
        ).kind).toBe('rate_limited');
    });

    test('does not classify Bitbucket Cloud 410 as a removed permission endpoint', () => {
        const cause = Object.assign(new Error('Gone'), { status: 410 });

        expect(classifyPermissionSyncUpstreamError(
            cause,
            'bitbucket-cloud',
            'list_accessible_repositories',
        ).kind).toBe('unknown');
    });

    test.each([
        Object.assign(new Error('Internal Server Error'), { status: 500 }),
        new TypeError('fetch failed'),
        Object.assign(new Error('request timed out'), { name: 'TimeoutError' }),
    ])('classifies an unavailable provider as transient', (cause) => {
        expect(classifyPermissionSyncUpstreamError(
            cause,
            'bitbucket-server',
            'list_accessible_repositories',
        ).kind).toBe('upstream_unavailable');
    });

    test('does not reclassify an existing permission sync error', async () => {
        const error = new PermissionSyncUpstreamError('Missing scope', {
            kind: 'insufficient_scope',
            provider: 'github',
            operation: 'inspect_token_scopes',
        });

        const caught = await withPermissionSyncUpstreamError(
            'github',
            'inspect_token_scopes',
            () => Promise.reject(error),
        ).catch(error => error);

        expect(caught).toBe(error);
    });
});
