import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Account, PrismaClient } from '@sourcebot/db';

const sharedMocks = vi.hoisted(() => ({
    decryptOAuthToken: vi.fn(),
    encryptOAuthToken: vi.fn(),
    getIdentityProviderConfig: vi.fn(),
    getTokenFromConfig: vi.fn(),
}));

vi.mock('@sourcebot/shared', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@sourcebot/shared')>();
    return {
        ...actual,
        createLogger: vi.fn(() => ({
            debug: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
        })),
        decryptOAuthToken: sharedMocks.decryptOAuthToken,
        encryptOAuthToken: sharedMocks.encryptOAuthToken,
        getIdentityProviderConfig: sharedMocks.getIdentityProviderConfig,
        getTokenFromConfig: sharedMocks.getTokenFromConfig,
    };
});

import { ensureFreshAccountToken, exchangeRefreshToken, TokenRefreshError } from './tokenRefresh.js';

const credentials = {
    clientId: 'client-id',
    clientSecret: 'client-secret',
    baseUrl: 'https://bitbucket.example.com/bitbucket',
};

const tokenResponse = () => new Response(JSON.stringify({
    access_token: 'new-access-token',
    refresh_token: 'new-refresh-token',
    expires_in: 3600,
}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
});

describe('exchangeRefreshToken', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        sharedMocks.decryptOAuthToken.mockReset().mockImplementation(token => token);
        sharedMocks.encryptOAuthToken.mockReset().mockImplementation(token => `encrypted:${token}`);
        sharedMocks.getIdentityProviderConfig.mockReset().mockResolvedValue({
            type: 'bitbucket-server',
            clientId: 'client-id',
            clientSecret: 'client-secret',
            baseUrl: credentials.baseUrl,
        });
        sharedMocks.getTokenFromConfig.mockReset().mockImplementation(token => Promise.resolve(token));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    test('returns a valid token response', async () => {
        const fetchMock = vi.fn().mockResolvedValue(tokenResponse());
        vi.stubGlobal('fetch', fetchMock);

        await expect(exchangeRefreshToken(
            'bitbucket-server',
            'old-refresh-token',
            credentials,
        )).resolves.toEqual({
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            expires_in: 3600,
        });

        expect(fetchMock).toHaveBeenCalledOnce();
        expect(fetchMock).toHaveBeenCalledWith(
            'https://bitbucket.example.com/bitbucket/rest/oauth2/latest/token',
            expect.objectContaining({
                method: 'POST',
                signal: expect.any(AbortSignal),
            }),
        );
    });

    test('classifies invalid_grant as a non-retryable credential rejection', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            error: 'invalid_grant',
            error_description: 'The provided refresh_token is invalid',
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        }));
        vi.stubGlobal('fetch', fetchMock);

        const error = await exchangeRefreshToken(
            'bitbucket-server',
            'old-refresh-token',
            credentials,
        ).catch(error => error);

        expect(error).toBeInstanceOf(TokenRefreshError);
        expect(error).toMatchObject({
            kind: 'invalid_grant',
            status: 400,
            oauthError: 'invalid_grant',
            errorDescription: 'The provided refresh_token is invalid',
            isRetryable: false,
        });
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    test('preserves the typed error through ensureFreshAccountToken', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            error: 'invalid_grant',
            error_description: 'The provided refresh_token is invalid',
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        }));
        vi.stubGlobal('fetch', fetchMock);

        const account = {
            id: 'account-id',
            providerId: 'bitbucket-server-idp',
            providerType: 'bitbucket-server',
            access_token: 'old-access-token',
            refresh_token: 'old-refresh-token',
            expires_at: 1,
        } as Account;
        const update = vi.fn().mockResolvedValue(account);
        const db = {
            account: { update },
        } as unknown as PrismaClient;

        const error = await ensureFreshAccountToken(account, db).catch(error => error);

        expect(error).toBeInstanceOf(TokenRefreshError);
        expect(error).toMatchObject({
            kind: 'invalid_grant',
            status: 400,
            oauthError: 'invalid_grant',
        });
        expect(update).toHaveBeenCalledOnce();
        expect(update).toHaveBeenCalledWith({
            where: { id: account.id },
            data: {
                tokenRefreshErrorMessage: 'bitbucket-server rejected the OAuth refresh token: The provided refresh_token is invalid',
            },
        });
    });

    test('retries a transient HTTP 500 response', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({
                errors: ['The server could not perform this operation'],
            }), { status: 500 }))
            .mockResolvedValueOnce(tokenResponse());
        vi.stubGlobal('fetch', fetchMock);

        const resultPromise = exchangeRefreshToken(
            'bitbucket-server',
            'old-refresh-token',
            credentials,
        );

        await vi.advanceTimersByTimeAsync(3000);

        await expect(resultPromise).resolves.toMatchObject({
            access_token: 'new-access-token',
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test('preserves the transient classification after retries are exhausted', async () => {
        const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(
            new Response(JSON.stringify({
                errors: ['The server could not perform this operation'],
            }), { status: 500 }),
        ));
        vi.stubGlobal('fetch', fetchMock);

        const resultPromise = exchangeRefreshToken(
            'bitbucket-server',
            'old-refresh-token',
            credentials,
        );
        resultPromise.catch(() => {});

        await vi.advanceTimersByTimeAsync(3000);
        await vi.advanceTimersByTimeAsync(6000);

        const error = await resultPromise.catch(error => error);
        expect(error).toBeInstanceOf(TokenRefreshError);
        expect(error).toMatchObject({
            kind: 'transient',
            status: 500,
            isRetryable: true,
        });
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    test('retries a transient network error', async () => {
        const fetchMock = vi.fn()
            .mockRejectedValueOnce(new TypeError('fetch failed'))
            .mockResolvedValueOnce(tokenResponse());
        vi.stubGlobal('fetch', fetchMock);

        const resultPromise = exchangeRefreshToken(
            'bitbucket-server',
            'old-refresh-token',
            credentials,
        );

        await vi.advanceTimersByTimeAsync(3000);

        await expect(resultPromise).resolves.toMatchObject({
            access_token: 'new-access-token',
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test('does not retry a non-invalid_grant OAuth rejection', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            error: 'invalid_client',
            error_description: 'Client authentication failed',
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        }));
        vi.stubGlobal('fetch', fetchMock);

        const error = await exchangeRefreshToken(
            'bitbucket-server',
            'old-refresh-token',
            credentials,
        ).catch(error => error);

        expect(error).toBeInstanceOf(TokenRefreshError);
        expect(error).toMatchObject({
            kind: 'configuration',
            status: 400,
            oauthError: 'invalid_client',
            isRetryable: false,
        });
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    test('classifies a malformed successful response as invalid_response', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            token: 'not-an-oauth-token-response',
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));
        vi.stubGlobal('fetch', fetchMock);

        const error = await exchangeRefreshToken(
            'bitbucket-server',
            'old-refresh-token',
            credentials,
        ).catch(error => error);

        expect(error).toBeInstanceOf(TokenRefreshError);
        expect(error).toMatchObject({
            kind: 'invalid_response',
            isRetryable: false,
        });
        expect(fetchMock).toHaveBeenCalledOnce();
    });
});
