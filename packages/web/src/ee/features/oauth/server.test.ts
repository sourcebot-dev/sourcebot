import { expect, test, vi, beforeEach, describe } from 'vitest';
import { MOCK_REFRESH_TOKEN, MOCK_USER_WITH_ACCOUNTS, prisma } from '@/__mocks__/prisma';
import { verifyAndExchangeCode, verifyAndRotateRefreshToken, revokeToken } from './server';

vi.mock('@/prisma', async () => {
    const actual = await vi.importActual<typeof import('@/__mocks__/prisma')>('@/__mocks__/prisma');
    return { ...actual };
});

vi.mock('server-only', () => ({ default: vi.fn() }));

vi.mock('@sourcebot/shared', () => ({
    hashSecret: vi.fn((s: string) => s),
    generateOAuthToken: vi.fn(() => ({ token: 'sboa_newtoken', hash: 'newtoken' })),
    generateOAuthRefreshToken: vi.fn(() => ({ token: 'sbor_newrefresh', hash: 'newrefresh' })),
    OAUTH_ACCESS_TOKEN_PREFIX: 'sboa_',
    OAUTH_REFRESH_TOKEN_PREFIX: 'sbor_',
}));

const VALID_CODE_HASH = 'validcode';
const VALID_AUTH_CODE = {
    codeHash: VALID_CODE_HASH,
    clientId: 'test-client-id',
    userId: MOCK_USER_WITH_ACCOUNTS.id,
    redirectUri: 'http://localhost:9999/callback',
    // SHA-256('myverifier') base64url
    codeChallenge: 'Eb223qLjTQNFkRjCVsrDbsBk5ycPKwHdbHNRX99tTeQ',
    resource: null,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    createdAt: new Date(),
};

beforeEach(() => {
    vi.clearAllMocks();
    // Default: resolve $transaction — individual operations are already mocked separately
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.$transaction.mockResolvedValue([] as any);
});

// ---------------------------------------------------------------------------
// verifyAndExchangeCode
// ---------------------------------------------------------------------------

describe('verifyAndExchangeCode', () => {
    test('returns access token and refresh token on success', async () => {
        prisma.oAuthAuthorizationCode.findUnique.mockResolvedValue(VALID_AUTH_CODE);
        prisma.oAuthAuthorizationCode.delete.mockResolvedValue(VALID_AUTH_CODE);
        prisma.oAuthToken.create.mockResolvedValue({} as never);
        prisma.oAuthRefreshToken.create.mockResolvedValue({} as never);

        const result = await verifyAndExchangeCode({
            rawCode: VALID_CODE_HASH,
            clientId: 'test-client-id',
            redirectUri: 'http://localhost:9999/callback',
            codeVerifier: 'myverifier',
            resource: null,
        });

        expect(result).toMatchObject({
            token: 'sboa_newtoken',
            refreshToken: 'sbor_newrefresh',
            expiresIn: expect.any(Number),
        });
    });

    test('returns invalid_grant if code is not found', async () => {
        prisma.oAuthAuthorizationCode.findUnique.mockResolvedValue(null);

        const result = await verifyAndExchangeCode({
            rawCode: 'nonexistent',
            clientId: 'test-client-id',
            redirectUri: 'http://localhost:9999/callback',
            codeVerifier: 'myverifier',
            resource: null,
        });

        expect(result).toMatchObject({ error: 'invalid_grant' });
    });

    test('returns invalid_grant if code is expired', async () => {
        prisma.oAuthAuthorizationCode.findUnique.mockResolvedValue({
            ...VALID_AUTH_CODE,
            expiresAt: new Date(Date.now() - 1000),
        });
        prisma.oAuthAuthorizationCode.delete.mockResolvedValue(VALID_AUTH_CODE);

        const result = await verifyAndExchangeCode({
            rawCode: VALID_CODE_HASH,
            clientId: 'test-client-id',
            redirectUri: 'http://localhost:9999/callback',
            codeVerifier: 'myverifier',
            resource: null,
        });

        expect(result).toMatchObject({ error: 'invalid_grant' });
    });

    test('returns invalid_grant if client_id does not match', async () => {
        prisma.oAuthAuthorizationCode.findUnique.mockResolvedValue(VALID_AUTH_CODE);

        const result = await verifyAndExchangeCode({
            rawCode: VALID_CODE_HASH,
            clientId: 'wrong-client-id',
            redirectUri: 'http://localhost:9999/callback',
            codeVerifier: 'myverifier',
            resource: null,
        });

        expect(result).toMatchObject({ error: 'invalid_grant' });
    });

    test('returns invalid_grant if redirect_uri does not match', async () => {
        prisma.oAuthAuthorizationCode.findUnique.mockResolvedValue(VALID_AUTH_CODE);

        const result = await verifyAndExchangeCode({
            rawCode: VALID_CODE_HASH,
            clientId: 'test-client-id',
            redirectUri: 'http://localhost:9999/wrong',
            codeVerifier: 'myverifier',
            resource: null,
        });

        expect(result).toMatchObject({ error: 'invalid_grant' });
    });

    test('returns invalid_grant if PKCE code_verifier is wrong', async () => {
        prisma.oAuthAuthorizationCode.findUnique.mockResolvedValue(VALID_AUTH_CODE);

        const result = await verifyAndExchangeCode({
            rawCode: VALID_CODE_HASH,
            clientId: 'test-client-id',
            redirectUri: 'http://localhost:9999/callback',
            codeVerifier: 'wrongverifier',
            resource: null,
        });

        expect(result).toMatchObject({ error: 'invalid_grant' });
    });

    test('returns invalid_target if resource does not match the bound value', async () => {
        prisma.oAuthAuthorizationCode.findUnique.mockResolvedValue({
            ...VALID_AUTH_CODE,
            resource: 'https://example.com/api/mcp',
        });

        const result = await verifyAndExchangeCode({
            rawCode: VALID_CODE_HASH,
            clientId: 'test-client-id',
            redirectUri: 'http://localhost:9999/callback',
            codeVerifier: 'myverifier',
            resource: 'https://other.com/api/mcp',
        });

        expect(result).toMatchObject({ error: 'invalid_target' });
    });

    test('returns invalid_grant if code was already used (P2025)', async () => {
        const { Prisma } = await vi.importActual<typeof import('@prisma/client')>('@prisma/client');
        prisma.oAuthAuthorizationCode.findUnique.mockResolvedValue(VALID_AUTH_CODE);
        prisma.oAuthAuthorizationCode.delete.mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '0' })
        );

        const result = await verifyAndExchangeCode({
            rawCode: VALID_CODE_HASH,
            clientId: 'test-client-id',
            redirectUri: 'http://localhost:9999/callback',
            codeVerifier: 'myverifier',
            resource: null,
        });

        expect(result).toMatchObject({ error: 'invalid_grant' });
    });

    test('rethrows unexpected errors from delete', async () => {
        prisma.oAuthAuthorizationCode.findUnique.mockResolvedValue(VALID_AUTH_CODE);
        prisma.oAuthAuthorizationCode.delete.mockRejectedValue(new Error('DB connection lost'));

        await expect(
            verifyAndExchangeCode({
                rawCode: VALID_CODE_HASH,
                clientId: 'test-client-id',
                redirectUri: 'http://localhost:9999/callback',
                codeVerifier: 'myverifier',
                resource: null,
            })
        ).rejects.toThrow('DB connection lost');
    });
});

// ---------------------------------------------------------------------------
// verifyAndRotateRefreshToken
// ---------------------------------------------------------------------------

describe('verifyAndRotateRefreshToken', () => {
    test('issues new access token and refresh token on success', async () => {
        prisma.oAuthRefreshToken.findUnique.mockResolvedValue(MOCK_REFRESH_TOKEN);
        prisma.oAuthRefreshToken.delete.mockResolvedValue(MOCK_REFRESH_TOKEN);
        prisma.oAuthToken.create.mockResolvedValue({} as never);
        prisma.oAuthRefreshToken.create.mockResolvedValue({} as never);

        const result = await verifyAndRotateRefreshToken({
            rawRefreshToken: 'sbor_refreshtoken',
            clientId: 'test-client-id',
            resource: null,
        });

        expect(result).toMatchObject({
            token: 'sboa_newtoken',
            refreshToken: 'sbor_newrefresh',
            expiresIn: expect.any(Number),
        });
    });

    test('returns invalid_grant and revokes all tokens when refresh token is not found (theft detection)', async () => {
        prisma.oAuthRefreshToken.findUnique.mockResolvedValue(null);
        prisma.oAuthToken.deleteMany.mockResolvedValue({ count: 1 });
        prisma.oAuthRefreshToken.deleteMany.mockResolvedValue({ count: 1 });

        const result = await verifyAndRotateRefreshToken({
            rawRefreshToken: 'sbor_used',
            clientId: 'test-client-id',
            resource: null,
        });

        expect(result).toMatchObject({ error: 'invalid_grant' });
        expect(prisma.oAuthToken.deleteMany).toHaveBeenCalledWith({ where: { clientId: 'test-client-id' } });
        expect(prisma.oAuthRefreshToken.deleteMany).toHaveBeenCalledWith({ where: { clientId: 'test-client-id' } });
    });

    test('returns invalid_grant if client_id does not match', async () => {
        prisma.oAuthRefreshToken.findUnique.mockResolvedValue(MOCK_REFRESH_TOKEN);

        const result = await verifyAndRotateRefreshToken({
            rawRefreshToken: 'sbor_refreshtoken',
            clientId: 'wrong-client-id',
            resource: null,
        });

        expect(result).toMatchObject({ error: 'invalid_grant' });
    });

    test('returns invalid_grant if refresh token is expired', async () => {
        prisma.oAuthRefreshToken.findUnique.mockResolvedValue({
            ...MOCK_REFRESH_TOKEN,
            expiresAt: new Date(Date.now() - 1000),
        });
        prisma.oAuthRefreshToken.delete.mockResolvedValue(MOCK_REFRESH_TOKEN);

        const result = await verifyAndRotateRefreshToken({
            rawRefreshToken: 'sbor_refreshtoken',
            clientId: 'test-client-id',
            resource: null,
        });

        expect(result).toMatchObject({ error: 'invalid_grant' });
    });

    test('returns invalid_target if resource does not match', async () => {
        prisma.oAuthRefreshToken.findUnique.mockResolvedValue({
            ...MOCK_REFRESH_TOKEN,
            resource: 'https://example.com/api/mcp',
        });

        const result = await verifyAndRotateRefreshToken({
            rawRefreshToken: 'sbor_refreshtoken',
            clientId: 'test-client-id',
            resource: 'https://other.com/api/mcp',
        });

        expect(result).toMatchObject({ error: 'invalid_target' });
    });

    test('old refresh token is deleted during rotation', async () => {
        prisma.oAuthRefreshToken.findUnique.mockResolvedValue(MOCK_REFRESH_TOKEN);
        prisma.oAuthRefreshToken.delete.mockResolvedValue(MOCK_REFRESH_TOKEN);
        prisma.oAuthToken.create.mockResolvedValue({} as never);
        prisma.oAuthRefreshToken.create.mockResolvedValue({} as never);

        await verifyAndRotateRefreshToken({
            rawRefreshToken: 'sbor_refreshtoken',
            clientId: 'test-client-id',
            resource: null,
        });

        expect(prisma.oAuthRefreshToken.delete).toHaveBeenCalledWith({ where: { hash: 'refreshtoken' } });
    });
});

// ---------------------------------------------------------------------------
// revokeToken
// ---------------------------------------------------------------------------

describe('revokeToken', () => {
    test('deletes an access token by hash', async () => {
        prisma.oAuthToken.deleteMany.mockResolvedValue({ count: 1 });

        await revokeToken('sboa_mytoken');

        expect(prisma.oAuthToken.deleteMany).toHaveBeenCalledWith({ where: { hash: 'mytoken' } });
    });

    test('deletes a refresh token by hash', async () => {
        prisma.oAuthRefreshToken.deleteMany.mockResolvedValue({ count: 1 });

        await revokeToken('sbor_myrefresh');

        expect(prisma.oAuthRefreshToken.deleteMany).toHaveBeenCalledWith({ where: { hash: 'myrefresh' } });
    });

    test('does nothing for an unrecognised token prefix', async () => {
        await revokeToken('unknown-token');

        expect(prisma.oAuthToken.deleteMany).not.toHaveBeenCalled();
        expect(prisma.oAuthRefreshToken.deleteMany).not.toHaveBeenCalled();
    });

    test('succeeds even if the token does not exist (RFC 7009)', async () => {
        prisma.oAuthToken.deleteMany.mockResolvedValue({ count: 0 });

        await expect(revokeToken('sboa_nonexistent')).resolves.toBeUndefined();
    });
});
