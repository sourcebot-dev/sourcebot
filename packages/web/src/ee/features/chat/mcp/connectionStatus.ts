import type { OAuthTokens } from '@ai-sdk/mcp';
import { decryptOAuthToken } from '@sourcebot/shared';

export type StoredMcpConnectionStatus =
    | { state: 'connected'; tokens: OAuthTokens }
    | { state: 'expired'; tokens: OAuthTokens }
    | { state: 'not_connected' };

export function isTokenExpiredWithNoRefresh(tokens: OAuthTokens, tokensExpiresAt: Date | null): boolean {
    if (tokens.refresh_token) {
        return false;
    }
    if (!tokensExpiresAt) {
        return false;
    }
    return new Date() > tokensExpiresAt;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function parseStoredOAuthTokens(value: string): OAuthTokens | undefined {
    const parsed = JSON.parse(value);
    if (!isRecord(parsed)) {
        return undefined;
    }
    if (typeof parsed.access_token !== 'string' || typeof parsed.token_type !== 'string') {
        return undefined;
    }
    if (parsed.refresh_token !== undefined && typeof parsed.refresh_token !== 'string') {
        return undefined;
    }
    if (parsed.expires_in !== undefined && typeof parsed.expires_in !== 'number') {
        return undefined;
    }
    if (parsed.scope !== undefined && typeof parsed.scope !== 'string') {
        return undefined;
    }
    if (parsed.id_token !== undefined && typeof parsed.id_token !== 'string') {
        return undefined;
    }

    return parsed as OAuthTokens;
}

export function getStoredMcpConnectionStatus(
    encryptedTokens: string | null | undefined,
    tokensExpiresAt: Date | null,
): StoredMcpConnectionStatus {
    if (!encryptedTokens) {
        return { state: 'not_connected' };
    }

    try {
        const decrypted = decryptOAuthToken(encryptedTokens);
        if (!decrypted) {
            return { state: 'not_connected' };
        }

        const tokens = parseStoredOAuthTokens(decrypted);
        if (!tokens) {
            return { state: 'not_connected' };
        }

        if (isTokenExpiredWithNoRefresh(tokens, tokensExpiresAt)) {
            return { state: 'expired', tokens };
        }

        return { state: 'connected', tokens };
    } catch {
        return { state: 'not_connected' };
    }
}
