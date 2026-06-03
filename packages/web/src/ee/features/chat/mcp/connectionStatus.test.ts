import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { OAuthTokens } from '@ai-sdk/mcp';

const decryptOAuthToken = vi.hoisted(() => vi.fn());

vi.mock('@sourcebot/shared', () => ({
    decryptOAuthToken,
}));

const { getStoredMcpConnectionStatus, isTokenExpiredWithNoRefresh } = await import('./connectionStatus');

const PAST = new Date('2020-01-01');
const FUTURE = new Date('2099-01-01');
const TOKEN_NO_REFRESH: OAuthTokens = { access_token: 'tok', token_type: 'Bearer' };
const TOKEN_WITH_REFRESH: OAuthTokens = { access_token: 'tok', token_type: 'Bearer', refresh_token: 'ref' };

beforeEach(() => {
    decryptOAuthToken.mockReset();
    decryptOAuthToken.mockImplementation((value: string) => value);
});

describe('isTokenExpiredWithNoRefresh', () => {
    test('returns true when an access token is expired and has no refresh token', () => {
        expect(isTokenExpiredWithNoRefresh(TOKEN_NO_REFRESH, PAST)).toBe(true);
    });

    test('returns false when a refresh token is present', () => {
        expect(isTokenExpiredWithNoRefresh(TOKEN_WITH_REFRESH, PAST)).toBe(false);
    });

    test('returns false when there is no stored expiration', () => {
        expect(isTokenExpiredWithNoRefresh(TOKEN_NO_REFRESH, null)).toBe(false);
    });

    test('returns false when the access token has not expired', () => {
        expect(isTokenExpiredWithNoRefresh(TOKEN_NO_REFRESH, FUTURE)).toBe(false);
    });
});

describe('getStoredMcpConnectionStatus', () => {
    test('returns not_connected when no encrypted tokens are stored', () => {
        expect(getStoredMcpConnectionStatus(null, null)).toEqual({ state: 'not_connected' });
    });

    test('returns not_connected when tokens cannot be decrypted', () => {
        decryptOAuthToken.mockReturnValueOnce(null);

        expect(getStoredMcpConnectionStatus('encrypted', null)).toEqual({ state: 'not_connected' });
    });

    test('returns not_connected when decrypted tokens are malformed', () => {
        decryptOAuthToken.mockReturnValueOnce('not json');

        expect(getStoredMcpConnectionStatus('encrypted', null)).toEqual({ state: 'not_connected' });
    });

    test('returns not_connected when decrypted tokens are missing required OAuth fields', () => {
        expect(getStoredMcpConnectionStatus(JSON.stringify({ token_type: 'Bearer' }), null)).toEqual({ state: 'not_connected' });
        expect(getStoredMcpConnectionStatus(JSON.stringify({ access_token: 'tok' }), null)).toEqual({ state: 'not_connected' });
    });

    test('returns not_connected when optional OAuth fields have unexpected types', () => {
        expect(getStoredMcpConnectionStatus(JSON.stringify({
            access_token: 'tok',
            token_type: 'Bearer',
            refresh_token: true,
        }), null)).toEqual({ state: 'not_connected' });
    });

    test('returns expired when an access token has expired and cannot be refreshed', () => {
        const status = getStoredMcpConnectionStatus(JSON.stringify(TOKEN_NO_REFRESH), PAST);

        expect(status).toEqual({ state: 'expired', tokens: TOKEN_NO_REFRESH });
    });

    test('returns connected when a token can be used or refreshed', () => {
        const status = getStoredMcpConnectionStatus(JSON.stringify(TOKEN_WITH_REFRESH), PAST);

        expect(status).toEqual({ state: 'connected', tokens: TOKEN_WITH_REFRESH });
    });
});
