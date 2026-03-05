import 'server-only';

import { prisma } from '@/prisma';
import { Prisma } from '@prisma/client';
import {
    generateOAuthRefreshToken,
    generateOAuthToken,
    hashSecret,
    OAUTH_ACCESS_TOKEN_PREFIX,
    OAUTH_REFRESH_TOKEN_PREFIX,
} from '@sourcebot/shared';
import crypto from 'crypto';

const AUTH_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export const ACCESS_TOKEN_TTL_SECONDS = Math.floor(ACCESS_TOKEN_TTL_MS / 1000);

// Generates a random authorization code, hashes it, and stores it alongside the
// PKCE code challenge. Returns the raw code to be sent to the client.
export async function generateAndStoreAuthCode({
    clientId,
    userId,
    redirectUri,
    codeChallenge,
    resource,
}: {
    clientId: string;
    userId: string;
    redirectUri: string;
    codeChallenge: string;
    resource: string | null;
}): Promise<string> {
    const rawCode = crypto.randomBytes(32).toString('hex');
    const codeHash = hashSecret(rawCode);

    await prisma.oAuthAuthorizationCode.create({
        data: {
            codeHash,
            clientId,
            userId,
            redirectUri,
            codeChallenge,
            resource,
            expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
        },
    });

    return rawCode;
}

// Verifies the authorization code and PKCE code verifier, then exchanges them for
// an opaque access token. The auth code is deleted after use (single-use).
export async function verifyAndExchangeCode({
    rawCode,
    clientId,
    redirectUri,
    codeVerifier,
    resource,
}: {
    rawCode: string;
    clientId: string;
    redirectUri: string;
    codeVerifier: string;
    resource: string | null;
}): Promise<{ token: string; refreshToken: string; expiresIn: number } | { error: string; errorDescription: string }> {
    const codeHash = hashSecret(rawCode);

    const authCode = await prisma.oAuthAuthorizationCode.findUnique({
        where: { codeHash },
    });

    if (!authCode) {
        return { error: 'invalid_grant', errorDescription: 'Authorization code not found.' };
    }

    if (authCode.expiresAt < new Date()) {
        await prisma.oAuthAuthorizationCode.delete({ where: { codeHash } });
        return { error: 'invalid_grant', errorDescription: 'Authorization code has expired.' };
    }

    if (authCode.clientId !== clientId) {
        return { error: 'invalid_grant', errorDescription: 'Client ID mismatch.' };
    }

    if (authCode.redirectUri !== redirectUri) {
        return { error: 'invalid_grant', errorDescription: 'Redirect URI mismatch.' };
    }

    // PKCE verification: BASE64URL(SHA-256(codeVerifier)) must equal stored codeChallenge
    const computedChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

    if (computedChallenge !== authCode.codeChallenge) {
        return { error: 'invalid_grant', errorDescription: 'PKCE code verifier is invalid.' };
    }

    // RFC 8707: if a resource was bound to the auth code, the token request must present the same value.
    if (authCode.resource !== null && authCode.resource !== resource) {
        return { error: 'invalid_target', errorDescription: 'resource parameter does not match the value bound to the authorization code.' };
    }

    // Single-use: delete the auth code before issuing token.
    // Handle concurrent consume attempts gracefully.
    try {
        await prisma.oAuthAuthorizationCode.delete({ where: { codeHash } });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return { error: 'invalid_grant', errorDescription: 'Authorization code has already been used.' };
        }
        throw error;
    }

    const { token, hash } = generateOAuthToken();
    const { token: refreshToken, hash: refreshHash } = generateOAuthRefreshToken();

    await prisma.$transaction([
        prisma.oAuthToken.create({
            data: {
                hash,
                clientId,
                userId: authCode.userId,
                resource: authCode.resource,
                expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_MS),
            },
        }),
        prisma.oAuthRefreshToken.create({
            data: {
                hash: refreshHash,
                clientId,
                userId: authCode.userId,
                resource: authCode.resource,
                expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
            },
        }),
    ]);

    return { token, refreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

// Verifies a refresh token, rotates it, and issues a new access token + refresh token.
// If the refresh token has already been used (deleted), revokes all tokens for the client/user
// as a token theft signal (OAuth 2.1 Section 4.3.1).
export async function verifyAndRotateRefreshToken({
    rawRefreshToken,
    clientId,
    resource,
}: {
    rawRefreshToken: string;
    clientId: string;
    resource: string | null;
}): Promise<{ token: string; refreshToken: string; expiresIn: number } | { error: string; errorDescription: string }> {
    if (!rawRefreshToken.startsWith(OAUTH_REFRESH_TOKEN_PREFIX)) {
        return { error: 'invalid_grant', errorDescription: 'Refresh token is invalid.' };
    }

    const hash = hashSecret(rawRefreshToken.slice(OAUTH_REFRESH_TOKEN_PREFIX.length));

    const existing = await prisma.oAuthRefreshToken.findUnique({ where: { hash } });

    if (!existing) {
        return { error: 'invalid_grant', errorDescription: 'Refresh token is invalid or has already been used.' };
    }

    if (existing.clientId !== clientId) {
        return { error: 'invalid_grant', errorDescription: 'Client ID mismatch.' };
    }

    if (existing.expiresAt < new Date()) {
        await prisma.oAuthRefreshToken.delete({ where: { hash } });
        return { error: 'invalid_grant', errorDescription: 'Refresh token has expired.' };
    }

    if (existing.resource !== null && existing.resource !== resource) {
        return { error: 'invalid_target', errorDescription: 'resource parameter does not match the refresh token.' };
    }

    const { token, hash: newTokenHash } = generateOAuthToken();
    const { token: refreshToken, hash: newRefreshHash } = generateOAuthRefreshToken();

    await prisma.$transaction([
        prisma.oAuthRefreshToken.delete({ where: { hash } }),
        prisma.oAuthToken.create({
            data: {
                hash: newTokenHash,
                clientId,
                userId: existing.userId,
                resource: existing.resource,
                expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_MS),
            },
        }),
        prisma.oAuthRefreshToken.create({
            data: {
                hash: newRefreshHash,
                clientId,
                userId: existing.userId,
                resource: existing.resource,
                expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
            },
        }),
    ]);

    return { token, refreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

// Revokes an access token or refresh token by hashing it and deleting the DB record.
// Per RFC 7009, revocation always succeeds even if the token doesn't exist.
export async function revokeToken(rawToken: string): Promise<void> {
    if (rawToken.startsWith(OAUTH_ACCESS_TOKEN_PREFIX)) {
        const secret = rawToken.slice(OAUTH_ACCESS_TOKEN_PREFIX.length);
        const hash = hashSecret(secret);
        await prisma.oAuthToken.deleteMany({ where: { hash } });
    } else if (rawToken.startsWith(OAUTH_REFRESH_TOKEN_PREFIX)) {
        const secret = rawToken.slice(OAUTH_REFRESH_TOKEN_PREFIX.length);
        const hash = hashSecret(secret);
        await prisma.oAuthRefreshToken.deleteMany({ where: { hash } });
    }
}
