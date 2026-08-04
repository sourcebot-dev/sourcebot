import { describe, expect, test } from 'vitest';
import { RequestError } from '@octokit/request-error';
import { GitbeakerRequestError } from '@gitbeaker/requester-utils';
import { getErrorHeader, getErrorStatus, isForbidden, isGone, isUnauthorized } from './errors';
import { throwOnHttpError } from './bitbucket';

// Helper: invoke the openapi-fetch middleware against a synthetic Response and
// return the thrown error (or null if it didn't throw). Validates the actual
// contract — not a hand-rolled mock of what we hope the middleware produces.
const invokeMiddleware = async (response: Response): Promise<unknown> => {
    try {
        await throwOnHttpError.onResponse!({
            request: new Request('https://example.test'),
            response,
            schemaPath: '/path',
            params: {},
            options: {} as never,
            id: 'test',
        });
        return null;
    } catch (e) {
        return e;
    }
};

describe('HTTP error metadata', () => {
    test('reads status and case-insensitive headers from a direct response', () => {
        const error = Object.assign(new Error('Rate limited'), {
            response: {
                status: 429,
                headers: {
                    'Retry-After': '30',
                },
            },
        });

        expect(getErrorStatus(error)).toBe(429);
        expect(getErrorHeader(error, 'retry-after')).toBe('30');
    });

    test('reads status and native Headers from a nested cause response', () => {
        const error = Object.assign(new Error('Rate limited'), {
            cause: {
                response: new Response(null, {
                    status: 429,
                    headers: {
                        'X-RateLimit-Remaining': '0',
                    },
                }),
            },
        });

        expect(getErrorStatus(error)).toBe(429);
        expect(getErrorHeader(error, 'x-ratelimit-remaining')).toBe('0');
    });

    test('combines a direct status with headers from the direct response', () => {
        const error = Object.assign(new Error('Rate limited'), {
            status: 403,
            response: {
                headers: {
                    'x-ratelimit-remaining': '0',
                },
            },
        });

        expect(getErrorStatus(error)).toBe(403);
        expect(getErrorHeader(error, 'X-RateLimit-Remaining')).toBe('0');
    });

    test('returns no metadata for a plain error', () => {
        const error = new Error('Not an HTTP error');

        expect(getErrorStatus(error)).toBeNull();
        expect(getErrorHeader(error, 'retry-after')).toBeUndefined();
    });
});

describe('isUnauthorized', () => {
    test('Octokit RequestError with status 401', () => {
        const err = new RequestError('Unauthorized', 401, {
            request: { method: 'GET', url: 'https://api.github.com/user/repos', headers: {} },
        });
        expect(isUnauthorized(err)).toBe(true);
    });

    test('Octokit RequestError with status 403 is NOT unauthorized', () => {
        const err = new RequestError('Forbidden', 403, {
            request: { method: 'GET', url: 'https://api.github.com/user/repos', headers: {} },
        });
        expect(isUnauthorized(err)).toBe(false);
    });

    test('real GitbeakerRequestError with response status 401', () => {
        const err = new GitbeakerRequestError('Unauthorized', {
            cause: {
                description: 'Unauthorized',
                request: new Request('https://gitlab.com/api/v4/projects'),
                response: new Response(null, { status: 401 }),
            },
        });
        expect(isUnauthorized(err)).toBe(true);
    });

    test('Bitbucket middleware throws an isUnauthorized error on 401 Response', async () => {
        const err = await invokeMiddleware(new Response('unauthorized body', { status: 401 }));
        expect(err).toBeInstanceOf(Error);
        expect(isUnauthorized(err)).toBe(true);
    });

    test('tokenRefresh invalid_grant synthetic 401', () => {
        // Shape produced by ensureFreshAccountToken when invalid_grant is returned.
        const err = Object.assign(new Error('OAuth invalid_grant'), { status: 401 });
        expect(isUnauthorized(err)).toBe(true);
    });

    test('plain Error without status is NOT unauthorized', () => {
        // e.g. "missing scope" errors, decryption failures.
        expect(isUnauthorized(new Error('Missing required scope'))).toBe(false);
    });

    test('TypeError from fetch (network failure) is NOT unauthorized', () => {
        // Node fetch network errors have no .status.
        const err = new TypeError('fetch failed');
        expect(isUnauthorized(err)).toBe(false);
    });

    test('null is NOT unauthorized', () => {
        expect(isUnauthorized(null)).toBe(false);
    });

    test('undefined is NOT unauthorized', () => {
        expect(isUnauthorized(undefined)).toBe(false);
    });

    test('non-Error throwable (string) is NOT unauthorized', () => {
        expect(isUnauthorized('boom')).toBe(false);
    });

    test('object with non-numeric status is NOT unauthorized', () => {
        expect(isUnauthorized({ status: '401' })).toBe(false);
    });

    test('Octokit RequestError with status 500 is NOT unauthorized', () => {
        const err = new RequestError('Internal Server Error', 500, {
            request: { method: 'GET', url: 'https://api.github.com/user/repos', headers: {} },
        });
        expect(isUnauthorized(err)).toBe(false);
    });

    test('object missing both direct and nested status is NOT unauthorized', () => {
        expect(isUnauthorized({ message: 'something' })).toBe(false);
    });
});

describe('isForbidden', () => {
    test('Octokit RequestError with status 403', () => {
        const err = new RequestError('Forbidden', 403, {
            request: { method: 'GET', url: 'https://api.github.com/user/repos', headers: {} },
        });
        expect(isForbidden(err)).toBe(true);
    });

    test('Octokit RequestError with status 401 is NOT forbidden', () => {
        const err = new RequestError('Unauthorized', 401, {
            request: { method: 'GET', url: 'https://api.github.com/user/repos', headers: {} },
        });
        expect(isForbidden(err)).toBe(false);
    });

    test('real GitbeakerRequestError with response status 403', () => {
        const err = new GitbeakerRequestError('Forbidden', {
            cause: {
                description: 'Forbidden',
                request: new Request('https://gitlab.com/api/v4/projects'),
                response: new Response(null, { status: 403 }),
            },
        });
        expect(isForbidden(err)).toBe(true);
    });

    test('Bitbucket middleware throws an isForbidden error on 403 Response', async () => {
        const err = await invokeMiddleware(new Response('forbidden body', { status: 403 }));
        expect(err).toBeInstanceOf(Error);
        expect(isForbidden(err)).toBe(true);
    });

    test('plain Error without status is NOT forbidden', () => {
        expect(isForbidden(new Error('Missing required scope'))).toBe(false);
    });

    test('null is NOT forbidden', () => {
        expect(isForbidden(null)).toBe(false);
    });

    test('Octokit RequestError with status 500 is NOT forbidden', () => {
        const err = new RequestError('Internal Server Error', 500, {
            request: { method: 'GET', url: 'https://api.github.com/user/repos', headers: {} },
        });
        expect(isForbidden(err)).toBe(false);
    });
});

describe('isGone', () => {
    test('Octokit RequestError with status 410', () => {
        const err = new RequestError('Gone', 410, {
            request: { method: 'GET', url: 'https://api.github.com/user/repos', headers: {} },
        });
        expect(isGone(err)).toBe(true);
    });

    test('Octokit RequestError with status 401 is NOT gone', () => {
        const err = new RequestError('Unauthorized', 401, {
            request: { method: 'GET', url: 'https://api.github.com/user/repos', headers: {} },
        });
        expect(isGone(err)).toBe(false);
    });

    test('Bitbucket middleware throws an isGone error on 410 Response', async () => {
        // Real-world case: Bitbucket Cloud's CHANGE-2770 removed
        // /2.0/user/permissions/repositories and now returns 410 Gone.
        const err = await invokeMiddleware(new Response('CHANGE-2770 - Functionality has been deprecated', { status: 410 }));
        expect(err).toBeInstanceOf(Error);
        expect(isGone(err)).toBe(true);
    });

    test('real GitbeakerRequestError with response status 410', () => {
        const err = new GitbeakerRequestError('Gone', {
            cause: {
                description: 'Gone',
                request: new Request('https://gitlab.com/api/v4/projects'),
                response: new Response(null, { status: 410 }),
            },
        });
        expect(isGone(err)).toBe(true);
    });

    test('plain Error without status is NOT gone', () => {
        expect(isGone(new Error('Missing required scope'))).toBe(false);
    });

    test('null is NOT gone', () => {
        expect(isGone(null)).toBe(false);
    });

    test('Octokit RequestError with status 500 is NOT gone', () => {
        const err = new RequestError('Internal Server Error', 500, {
            request: { method: 'GET', url: 'https://api.github.com/user/repos', headers: {} },
        });
        expect(isGone(err)).toBe(false);
    });
});

describe('throwOnHttpError middleware contract', () => {
    test('does not throw on 2xx Response', async () => {
        const err = await invokeMiddleware(new Response('ok', { status: 200 }));
        expect(err).toBeNull();
    });

    test('does not throw on 204 No Content', async () => {
        // 204 is 2xx, so middleware should pass through. (Downstream code uses
        // `data!` assertions that would misbehave on undefined — but that's a
        // bitbucket.ts call-site concern, not a middleware-contract concern.)
        const err = await invokeMiddleware(new Response(null, { status: 204 }));
        expect(err).toBeNull();
    });

    test('throws on 500 Response with status attached', async () => {
        const err = await invokeMiddleware(new Response('boom', { status: 500 }));
        expect(err).toBeInstanceOf(Error);
        expect((err as { status?: number }).status).toBe(500);
    });

    test('throws on 404 Response with status attached', async () => {
        const err = await invokeMiddleware(new Response('not found', { status: 404 }));
        expect(err).toBeInstanceOf(Error);
        expect((err as { status?: number }).status).toBe(404);
    });
});

describe('precedence: direct .status wins over nested .cause.response.status', () => {
    test('direct status 0 returns 0, ignoring nested 401', () => {
        // Latent precedence: if an error somehow has BOTH, direct wins.
        const err = Object.assign(new Error('weird'), {
            status: 0,
            cause: { response: { status: 401 } },
        });
        expect(isUnauthorized(err)).toBe(false);
    });
});
