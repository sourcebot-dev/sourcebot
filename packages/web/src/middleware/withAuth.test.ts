import { expect, test, vi, beforeEach, describe } from 'vitest';
import { Session } from 'next-auth';
import { NextRequest } from 'next/server';
import { notAuthenticated } from '../lib/serviceError';
import { getAuthContext, getAuthenticatedUser, withAuth, withOptionalAuth } from './withAuth';
import { MOCK_API_KEY, MOCK_OAUTH_TOKEN, MOCK_ORG, MOCK_USER_WITH_ACCOUNTS, prisma } from '../__mocks__/prisma';
import { OrgRole } from '@sourcebot/db';
import { ErrorCode } from '../lib/errorCodes';
import { StatusCodes } from 'http-status-codes';
import { userScopedPrismaClientExtension } from '@/prisma';
import { runWithRequestContext } from '@/lib/requestContext';
import { getCurrentUser } from '@/lib/currentUserContext';

const TEST_OAUTH_SCOPE = 'read';

const mocks = vi.hoisted(() => {
    return {
        // Defaults to a empty session.
        auth: vi.fn(async (): Promise<Session | null> => null),
        headers: vi.fn(async (): Promise<Headers> => new Headers()),
        hasEntitlement: vi.fn((_entitlement: string) => false),
        isAnonymousAccessAvailable: vi.fn(() => false),
        syncWithLighthouse: vi.fn(async (_orgId: number) => undefined),
        getSeatCap: vi.fn(() => undefined as number | undefined),
        env: {} as Record<string, string>,
    }
});

vi.mock('../auth', () => ({
    auth: mocks.auth,
}));

vi.mock('next/headers', () => ({
    headers: mocks.headers,
}));

vi.mock('@/prisma', async () => {
    // @see: https://github.com/prisma/prisma/discussions/20244#discussioncomment-7976447
    const actual = await vi.importActual<typeof import('@/__mocks__/prisma')>('@/__mocks__/prisma');
    return {
        ...actual,
    };
});

vi.mock('server-only', () => ({
    default: vi.fn(),
}));

vi.mock('@/features/billing/servicePing', () => ({
    syncWithLighthouse: mocks.syncWithLighthouse,
}));

vi.mock('@sourcebot/shared', () => ({
    _hasEntitlement: mocks.hasEntitlement,
    _getEntitlements: vi.fn(() => []),
    _isAnonymousAccessAvailable: mocks.isAnonymousAccessAvailable,
    hashSecret: vi.fn((secret: string) => secret),
    OAUTH_ACCESS_TOKEN_PREFIX: 'sboa_',
    API_KEY_PREFIX: 'sbk_',
    LEGACY_API_KEY_PREFIX: 'sourcebot-',
    env: mocks.env,
    getSeatCap: mocks.getSeatCap,
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    })),
}));

// Test utility to set the mock session
const setMockSession = (session: Session | null) => {
    mocks.auth.mockResolvedValue(session);
};

const setMockHeaders = (headers: Headers) => {
    mocks.headers.mockResolvedValue(headers);
};

const SUSPENDED_AT = new Date('2026-01-01T00:00:00.000Z');

// Helper to create mock session objects
const createMockSession = (overrides: Partial<Session> = {}): Session => ({
    user: {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        ...overrides.user,
    },
    expires: '2099-01-01T00:00:00.000Z',
    ...overrides,
});


beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userScopedPrismaClientExtension).mockReset();
    mocks.auth.mockResolvedValue(null);
    mocks.headers.mockResolvedValue(new Headers());
    mocks.hasEntitlement.mockReturnValue(false);
    mocks.isAnonymousAccessAvailable.mockReturnValue(false);
    // getAuthContext fires `prisma.user.update().catch(...)` and
    // `prisma.userToOrg.updateMany().catch(...)` to bump lastActiveAt; without a
    // default, the reset mock returns undefined and the .catch chain throws.
    prisma.user.update.mockResolvedValue(MOCK_USER_WITH_ACCOUNTS);
    prisma.userToOrg.updateMany.mockResolvedValue({ count: 0 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(prisma));
    mocks.getSeatCap.mockReturnValue(undefined);
    // Reset env flags between tests
    Object.keys(mocks.env).forEach(key => delete mocks.env[key]);
});

describe('getAuthenticatedUser', () => {
    test('should return a user object if a valid session is present', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        setMockSession(createMockSession({ user: { id: 'test-user-id' } }));
        const result = await getAuthenticatedUser();
        expect(result).not.toBeUndefined();
        expect(result?.user.id).toBe(userId);
        expect(result?.source).toBe('session');
    });

    test('should return a user object if a valid api key is present', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.apiKey.findUnique.mockResolvedValue({
            ...MOCK_API_KEY,
            hash: 'apikey',
            createdById: userId,
        });

        setMockHeaders(new Headers({ 'X-Sourcebot-Api-Key': 'sourcebot-apikey' }));
        const result = await getAuthenticatedUser();
        expect(result).not.toBeUndefined();
        expect(result?.user.id).toBe(userId);
        expect(result?.source).toBe('api_key');
        expect(prisma.apiKey.update).toHaveBeenCalledWith({
            where: {
                hash: 'apikey',
            },
            data: {
                lastUsedAt: expect.any(Date),
            },
        });
    });

    test('should return a user object if a valid api key with the new sbk_ prefix is present', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.apiKey.findUnique.mockResolvedValue({
            ...MOCK_API_KEY,
            hash: 'apikey',
            createdById: userId,
        });

        setMockHeaders(new Headers({ 'X-Sourcebot-Api-Key': 'sbk_apikey' }));
        const result = await getAuthenticatedUser();
        expect(result).not.toBeUndefined();
        expect(result?.user.id).toBe(userId);
        expect(result?.source).toBe('api_key');
        expect(prisma.apiKey.update).toHaveBeenCalledWith({
            where: { hash: 'apikey' },
            data: { lastUsedAt: expect.any(Date) },
        });
    });

    test('should return a user object if a valid Bearer token is present', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.apiKey.findUnique.mockResolvedValue({
            ...MOCK_API_KEY,
            hash: 'apikey',
            createdById: userId,
        });

        setMockHeaders(new Headers({ 'Authorization': 'Bearer sourcebot-apikey' }));
        const result = await getAuthenticatedUser();
        expect(result).not.toBeUndefined();
        expect(result?.user.id).toBe(userId);
        expect(result?.source).toBe('api_key');
        expect(prisma.apiKey.update).toHaveBeenCalledWith({
            where: {
                hash: 'apikey',
            },
            data: {
                lastUsedAt: expect.any(Date),
            },
        });
    });

    test('should use the current request context when no request is passed', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.apiKey.findUnique.mockResolvedValue({
            ...MOCK_API_KEY,
            hash: 'apikey',
            createdById: userId,
        });

        const request = new NextRequest('https://sourcebot.example.com/api/test', {
            headers: {
                Authorization: 'Bearer sourcebot-apikey',
            },
        });

        const result = await runWithRequestContext(request, () => getAuthenticatedUser());

        expect(result).not.toBeUndefined();
        expect(result?.user.id).toBe(userId);
        expect(result?.source).toBe('api_key');
        expect(mocks.headers).not.toHaveBeenCalled();
        expect(prisma.apiKey.update).toHaveBeenCalledWith({
            where: {
                hash: 'apikey',
            },
            data: {
                lastUsedAt: expect.any(Date),
            },
        });
    });

    test('should return undefined if a Bearer token is present but the API key does not exist', async () => {
        prisma.apiKey.findUnique.mockResolvedValue(null);
        setMockHeaders(new Headers({ 'Authorization': 'Bearer sourcebot-apikey' }));
        const user = await getAuthenticatedUser();
        expect(user).toBeUndefined();
    });

    test('should return a user object if a valid OAuth Bearer token is present', async () => {
        mocks.hasEntitlement.mockReturnValue(true);
        prisma.oAuthToken.findUnique.mockResolvedValue(MOCK_OAUTH_TOKEN);
        setMockHeaders(new Headers({ 'Authorization': 'Bearer sboa_oauthtoken' }));
        const result = await getAuthenticatedUser();
        expect(result).not.toBeUndefined();
        expect(result?.user.id).toBe(MOCK_USER_WITH_ACCOUNTS.id);
        expect(result?.source).toBe('oauth');
    });

    test('should return parsed scopes for a valid OAuth Bearer token', async () => {
        mocks.hasEntitlement.mockReturnValue(true);
        prisma.oAuthToken.findUnique.mockResolvedValue({
            ...MOCK_OAUTH_TOKEN,
            scope: `${TEST_OAUTH_SCOPE} other ${TEST_OAUTH_SCOPE}`,
        });
        setMockHeaders(new Headers({ 'Authorization': 'Bearer sboa_oauthtoken' }));
        const result = await getAuthenticatedUser();
        expect(result?.oauthScopes).toEqual([TEST_OAUTH_SCOPE, 'other']);
    });

    test('should update lastUsedAt when an OAuth Bearer token is used', async () => {
        mocks.hasEntitlement.mockReturnValue(true);
        prisma.oAuthToken.findUnique.mockResolvedValue(MOCK_OAUTH_TOKEN);
        setMockHeaders(new Headers({ 'Authorization': 'Bearer sboa_oauthtoken' }));
        await getAuthenticatedUser();
        expect(prisma.oAuthToken.update).toHaveBeenCalledWith({
            where: { hash: 'oauthtoken' },
            data: { lastUsedAt: expect.any(Date) },
        });
    });

    test('should return undefined if an OAuth Bearer token is present but the deployment does not have the oauth entitlement', async () => {
        mocks.hasEntitlement.mockReturnValue(false);
        prisma.oAuthToken.findUnique.mockResolvedValue(MOCK_OAUTH_TOKEN);
        setMockHeaders(new Headers({ 'Authorization': 'Bearer sboa_oauthtoken' }));
        const user = await getAuthenticatedUser();
        expect(user).toBeUndefined();
        expect(prisma.oAuthToken.findUnique).not.toHaveBeenCalled();
    });

    test('should return undefined if an OAuth Bearer token is present but the token does not exist', async () => {
        mocks.hasEntitlement.mockReturnValue(true);
        prisma.oAuthToken.findUnique.mockResolvedValue(null);
        setMockHeaders(new Headers({ 'Authorization': 'Bearer sboa_oauthtoken' }));
        const user = await getAuthenticatedUser();
        expect(user).toBeUndefined();
        expect(prisma.oAuthToken.findUnique).toHaveBeenCalled();
    });

    test('should return undefined if an OAuth Bearer token is present but the token is expired', async () => {
        mocks.hasEntitlement.mockReturnValue(true);
        prisma.oAuthToken.findUnique.mockResolvedValue({
            ...MOCK_OAUTH_TOKEN,
            expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
        });
        setMockHeaders(new Headers({ 'Authorization': 'Bearer sboa_oauthtoken' }));
        const user = await getAuthenticatedUser();
        expect(user).toBeUndefined();
        expect(prisma.oAuthToken.findUnique).toHaveBeenCalled();
    });

    test('should not check API key when a sboa_ Bearer token is present', async () => {
        mocks.hasEntitlement.mockReturnValue(true);
        prisma.oAuthToken.findUnique.mockResolvedValue(MOCK_OAUTH_TOKEN);
        setMockHeaders(new Headers({ 'Authorization': 'Bearer sboa_oauthtoken' }));
        await getAuthenticatedUser();
        expect(prisma.apiKey.findUnique).not.toHaveBeenCalled();
    });

    test('should reject a DPoP-bound OAuth token presented as Bearer', async () => {
        mocks.hasEntitlement.mockReturnValue(true);
        prisma.oAuthToken.findUnique.mockResolvedValue({
            ...MOCK_OAUTH_TOKEN,
            dpopJkt: 'dpop-thumbprint',
        });
        setMockHeaders(new Headers({ 'Authorization': 'Bearer sboa_oauthtoken' }));
        const user = await getAuthenticatedUser();
        expect(user).toBeUndefined();
        expect(prisma.oAuthToken.update).not.toHaveBeenCalled();
    });

    test('should reject an unbound OAuth token presented with the DPoP scheme', async () => {
        mocks.hasEntitlement.mockReturnValue(true);
        prisma.oAuthToken.findUnique.mockResolvedValue(MOCK_OAUTH_TOKEN);
        setMockHeaders(new Headers({ 'Authorization': 'DPoP sboa_oauthtoken' }));
        const user = await getAuthenticatedUser();
        expect(user).toBeUndefined();
        expect(prisma.oAuthToken.update).not.toHaveBeenCalled();
    });

    test('should return undefined if a Bearer token is present but the user is not found', async () => {
        prisma.user.findUnique.mockResolvedValue(null);
        prisma.apiKey.findUnique.mockResolvedValue({
            ...MOCK_API_KEY,
            hash: 'apikey',
            createdById: 'test-user-id',
        });
        setMockHeaders(new Headers({ 'Authorization': 'Bearer sourcebot-apikey' }));
        const user = await getAuthenticatedUser();
        expect(user).toBeUndefined();
    });

    test('should return undefined if no session or api key is present', async () => {
        const user = await getAuthenticatedUser();
        expect(user).toBeUndefined();
    });

    test('should return undefined if a api key does not exist', async () => {
        prisma.apiKey.findUnique.mockResolvedValue(null);
        setMockHeaders(new Headers({ 'X-Sourcebot-Api-Key': 'sourcebot-apikey' }));
        const user = await getAuthenticatedUser();
        expect(user).toBeUndefined();
    });

    test('should return undefined if a api key is present but is invalid', async () => {
        prisma.apiKey.findUnique.mockResolvedValue({
            ...MOCK_API_KEY,
            hash: 'different-hash',
            createdById: 'test-user-id',
        });
        setMockHeaders(new Headers({ 'X-Sourcebot-Api-Key': 'sourcebot-apikey' }));
        const user = await getAuthenticatedUser();
        expect(user).toBeUndefined();
    });

    test('should return undefined if a valid session is present but the user is not found', async () => {
        prisma.user.findUnique.mockResolvedValue(null);
        setMockSession(createMockSession({ user: { id: 'test-user-id' } }));
        const user = await getAuthenticatedUser();
        expect(user).toBeUndefined();
    });

    test('should return undefined if a valid api key is present but the user is not found', async () => {
        prisma.user.findUnique.mockResolvedValue(null);
        prisma.apiKey.findUnique.mockResolvedValue({
            ...MOCK_API_KEY,
            hash: 'apikey',
            createdById: 'test-user-id',
        });
        setMockHeaders(new Headers({ 'X-Sourcebot-Api-Key': 'sourcebot-apikey' }));
        const user = await getAuthenticatedUser();
        expect(user).toBeUndefined();
    });
});

describe('getAuthContext', () => {
    test('should return a auth context object if a valid session is present and the user is a member of the organization', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        prisma.userToOrg.findUnique.mockResolvedValue({
            joinedAt: new Date(),
            userId: userId,
            orgId: MOCK_ORG.id,
            suspendedAt: null,
            scimExternalId: null,
            lastActiveAt: null,
            role: OrgRole.MEMBER,
        });

        setMockSession(createMockSession({ user: { id: 'test-user-id' } }));
        const authContext = await getAuthContext();
        expect(authContext).not.toBeUndefined();
        expect(authContext).toStrictEqual({
            user: {
                ...MOCK_USER_WITH_ACCOUNTS,
                id: userId,
            },
            org: MOCK_ORG,
            role: OrgRole.MEMBER,
            prisma: undefined,
        });
    });

    test('should sync with Lighthouse when a pending member becomes active for the first time', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        prisma.userToOrg.findUnique.mockResolvedValue({
            joinedAt: new Date(),
            userId,
            orgId: MOCK_ORG.id,
            suspendedAt: null,
            scimExternalId: null,
            lastActiveAt: null,
            role: OrgRole.MEMBER,
        });
        prisma.userToOrg.updateMany.mockResolvedValue({ count: 1 });

        setMockSession(createMockSession({ user: { id: userId } }));
        await getAuthContext();

        expect(prisma.userToOrg.updateMany).toHaveBeenCalledWith({
            where: {
                orgId: MOCK_ORG.id,
                userId,
                suspendedAt: null,
                lastActiveAt: null,
            },
            data: { lastActiveAt: expect.any(Date) },
        });
        expect(mocks.syncWithLighthouse).toHaveBeenCalledWith(MOCK_ORG.id);
    });

    test('should activate a pending member when the org has an available seat', async () => {
        const userId = 'test-user-id';
        mocks.getSeatCap.mockReturnValue(2);
        prisma.userToOrg.count.mockResolvedValue(1);
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        prisma.userToOrg.findUnique.mockResolvedValue({
            joinedAt: new Date(),
            userId,
            orgId: MOCK_ORG.id,
            suspendedAt: null,
            scimExternalId: null,
            lastActiveAt: null,
            role: OrgRole.MEMBER,
        });
        prisma.userToOrg.updateMany.mockResolvedValue({ count: 1 });

        setMockSession(createMockSession({ user: { id: userId } }));
        const cb = vi.fn(async () => {
            expect(getCurrentUser()).toMatchObject({ id: userId });
        });
        const result = await withAuth(cb);

        expect(result).toBeUndefined();
        expect(cb).toHaveBeenCalledWith(expect.objectContaining({
            user: expect.objectContaining({ id: userId }),
            org: MOCK_ORG,
            role: OrgRole.MEMBER,
        }));
        expect(prisma.userToOrg.count).toHaveBeenCalledWith({
            where: {
                orgId: MOCK_ORG.id,
                suspendedAt: null,
                lastActiveAt: { not: null },
            },
        });
        expect(mocks.syncWithLighthouse).toHaveBeenCalledWith(MOCK_ORG.id);
    });

    test('should return a seat-limit service error when a pending member logs in at capacity', async () => {
        const userId = 'test-user-id';
        mocks.getSeatCap.mockReturnValue(1);
        prisma.userToOrg.count.mockResolvedValue(1);
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        prisma.userToOrg.findUnique.mockResolvedValue({
            joinedAt: new Date(),
            userId,
            orgId: MOCK_ORG.id,
            suspendedAt: null,
            scimExternalId: null,
            lastActiveAt: null,
            role: OrgRole.MEMBER,
        });

        setMockSession(createMockSession({ user: { id: userId } }));
        const cb = vi.fn();
        const result = await withAuth(cb);

        expect(cb).not.toHaveBeenCalled();
        expect(result).toStrictEqual({
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.ORG_SEAT_COUNT_REACHED,
            message: 'Organization is at max capacity',
        });
        expect(prisma.userToOrg.updateMany).not.toHaveBeenCalled();
        expect(mocks.syncWithLighthouse).not.toHaveBeenCalled();
    });

    test('should not sync with Lighthouse when another request already marked the member active', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        prisma.userToOrg.findUnique.mockResolvedValue({
            joinedAt: new Date(),
            userId,
            orgId: MOCK_ORG.id,
            suspendedAt: null,
            scimExternalId: null,
            lastActiveAt: null,
            role: OrgRole.MEMBER,
        });
        prisma.userToOrg.updateMany.mockResolvedValue({ count: 0 });

        setMockSession(createMockSession({ user: { id: userId } }));
        await getAuthContext();
        await Promise.resolve();

        expect(mocks.syncWithLighthouse).not.toHaveBeenCalled();
    });

    test('should not block an already-active member when the org is at capacity', async () => {
        const userId = 'test-user-id';
        mocks.getSeatCap.mockReturnValue(1);
        prisma.userToOrg.count.mockResolvedValue(1);
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        prisma.userToOrg.findUnique.mockResolvedValue({
            joinedAt: new Date(),
            userId,
            orgId: MOCK_ORG.id,
            suspendedAt: null,
            scimExternalId: null,
            lastActiveAt: new Date('2026-01-01T00:00:00.000Z'),
            role: OrgRole.MEMBER,
        });

        setMockSession(createMockSession({ user: { id: userId } }));
        const cb = vi.fn();
        const result = await withAuth(cb);

        expect(result).toBeUndefined();
        expect(cb).toHaveBeenCalledWith(expect.objectContaining({
            user: expect.objectContaining({ id: userId }),
            org: MOCK_ORG,
            role: OrgRole.MEMBER,
        }));
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    test('should return a auth context object if a valid session is present and the user is a member of the organization with OWNER role', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        prisma.userToOrg.findUnique.mockResolvedValue({
            joinedAt: new Date(),
            userId: userId,
            orgId: MOCK_ORG.id,
            suspendedAt: null,
            scimExternalId: null,
            lastActiveAt: null,
            role: OrgRole.OWNER,
        });

        setMockSession(createMockSession({ user: { id: 'test-user-id' } }));
        const authContext = await getAuthContext();
        expect(authContext).not.toBeUndefined();
        expect(authContext).toStrictEqual({
            user: {
                ...MOCK_USER_WITH_ACCOUNTS,
                id: userId,
            },
            org: MOCK_ORG,
            role: OrgRole.OWNER,
            prisma: undefined,
        });
    });

    test('should return a auth context object if a valid session is present and the user is not a member of the organization. The role should be undefined.', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        prisma.userToOrg.findUnique.mockResolvedValue(null);

        setMockSession(createMockSession({ user: { id: userId } }));
        const authContext = await getAuthContext();
        expect(authContext).not.toBeUndefined();
        expect(authContext).toStrictEqual({
            user: {
                ...MOCK_USER_WITH_ACCOUNTS,
                id: userId,
            },
            org: MOCK_ORG,
            prisma: undefined,
        });
    });

    test('should return a auth context object if no auth session is present. The role and user should be undefined.', async () => {
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        prisma.userToOrg.findUnique.mockResolvedValue(null);

        const authContext = await getAuthContext();
        expect(authContext).not.toBeUndefined();
        expect(authContext).toStrictEqual({
            user: undefined,
            org: MOCK_ORG,
            prisma: undefined,
        });
    });

    test('should not grant a role when the membership is suspended, even though the membership row exists', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        prisma.userToOrg.findUnique.mockResolvedValue({
            joinedAt: new Date(),
            userId: userId,
            orgId: MOCK_ORG.id,
            suspendedAt: SUSPENDED_AT,
            scimExternalId: null,
            lastActiveAt: null,
            role: OrgRole.OWNER,
        });

        setMockSession(createMockSession({ user: { id: userId } }));
        const authContext = await getAuthContext();
        expect(authContext).toStrictEqual({
            user: {
                ...MOCK_USER_WITH_ACCOUNTS,
                id: userId,
            },
            org: MOCK_ORG,
            prisma: undefined,
        });
        expect(prisma.userToOrg.updateMany).not.toHaveBeenCalled();
    });

    test('should not grant a role to a suspended member authenticating via API key (API-key auth bypasses the JWT sessionVersion logout, so this gate is what denies them)', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        prisma.userToOrg.findUnique.mockResolvedValue({
            joinedAt: new Date(),
            userId: userId,
            orgId: MOCK_ORG.id,
            suspendedAt: SUSPENDED_AT,
            scimExternalId: null,
            lastActiveAt: null,
            role: OrgRole.MEMBER,
        });
        prisma.apiKey.findUnique.mockResolvedValue({
            ...MOCK_API_KEY,
            hash: 'apikey',
            createdById: userId,
        });
        setMockHeaders(new Headers({ 'X-Sourcebot-Api-Key': 'sourcebot-apikey' }));

        const authContext = await getAuthContext();
        expect(authContext).toStrictEqual({
            user: {
                ...MOCK_USER_WITH_ACCOUNTS,
                id: userId,
            },
            org: MOCK_ORG,
            prisma: undefined,
        });
    });

    describe('DISABLE_API_KEY_USAGE_FOR_NON_OWNER_USERS', () => {
        test('should return a 403 service error when flag is enabled and a non-owner authenticates via api key', async () => {
            mocks.env.DISABLE_API_KEY_USAGE_FOR_NON_OWNER_USERS = 'true';
            const userId = 'test-user-id';
            prisma.user.findUnique.mockResolvedValue({ ...MOCK_USER_WITH_ACCOUNTS, id: userId });
            prisma.org.findUnique.mockResolvedValue({ ...MOCK_ORG });
            prisma.userToOrg.findUnique.mockResolvedValue({
                joinedAt: new Date(),
                userId,
                orgId: MOCK_ORG.id,
                suspendedAt: null,
                scimExternalId: null,
                lastActiveAt: null,
                role: OrgRole.MEMBER,
            });
            prisma.apiKey.findUnique.mockResolvedValue({ ...MOCK_API_KEY, hash: 'apikey', createdById: userId });
            setMockHeaders(new Headers({ 'X-Sourcebot-Api-Key': 'sourcebot-apikey' }));

            const authContext = await getAuthContext();
            expect(authContext).toStrictEqual({
                statusCode: StatusCodes.FORBIDDEN,
                errorCode: ErrorCode.API_KEY_USAGE_DISABLED,
                message: 'API key usage is disabled for non-admin users.',
            });
        });

        test('should allow an owner to authenticate via api key when flag is enabled', async () => {
            mocks.env.DISABLE_API_KEY_USAGE_FOR_NON_OWNER_USERS = 'true';
            const userId = 'test-user-id';
            prisma.user.findUnique.mockResolvedValue({ ...MOCK_USER_WITH_ACCOUNTS, id: userId });
            prisma.org.findUnique.mockResolvedValue({ ...MOCK_ORG });
            prisma.userToOrg.findUnique.mockResolvedValue({
                joinedAt: new Date(),
                userId,
                orgId: MOCK_ORG.id,
                suspendedAt: null,
                scimExternalId: null,
                lastActiveAt: null,
                role: OrgRole.OWNER,
            });
            prisma.apiKey.findUnique.mockResolvedValue({ ...MOCK_API_KEY, hash: 'apikey', createdById: userId });
            setMockHeaders(new Headers({ 'X-Sourcebot-Api-Key': 'sourcebot-apikey' }));

            const authContext = await getAuthContext();
            expect(authContext).toStrictEqual({
                user: { ...MOCK_USER_WITH_ACCOUNTS, id: userId },
                org: MOCK_ORG,
                role: OrgRole.OWNER,
                prisma: undefined,
            });
        });

        test('should allow a non-owner to authenticate via session when flag is enabled', async () => {
            mocks.env.DISABLE_API_KEY_USAGE_FOR_NON_OWNER_USERS = 'true';
            const userId = 'test-user-id';
            prisma.user.findUnique.mockResolvedValue({ ...MOCK_USER_WITH_ACCOUNTS, id: userId });
            prisma.org.findUnique.mockResolvedValue({ ...MOCK_ORG });
            prisma.userToOrg.findUnique.mockResolvedValue({
                joinedAt: new Date(),
                userId,
                orgId: MOCK_ORG.id,
                suspendedAt: null,
                scimExternalId: null,
                lastActiveAt: null,
                role: OrgRole.MEMBER,
            });
            setMockSession(createMockSession({ user: { id: userId } }));

            const authContext = await getAuthContext();
            expect(authContext).toStrictEqual({
                user: { ...MOCK_USER_WITH_ACCOUNTS, id: userId },
                org: MOCK_ORG,
                role: OrgRole.MEMBER,
                prisma: undefined,
            });
        });
    });

    describe('requiredOAuthScopes', () => {
        test('should allow OAuth bearer tokens that contain the required scope', async () => {
            const userId = 'test-user-id';
            mocks.hasEntitlement.mockReturnValue(true);
            const oauthToken = {
                ...MOCK_OAUTH_TOKEN,
                user: { ...MOCK_USER_WITH_ACCOUNTS, id: userId },
                scope: TEST_OAUTH_SCOPE,
            };
            prisma.oAuthToken.findUnique.mockResolvedValue(oauthToken);
            prisma.org.findUnique.mockResolvedValue({ ...MOCK_ORG });
            prisma.userToOrg.findUnique.mockResolvedValue({
                joinedAt: new Date(),
                userId,
                orgId: MOCK_ORG.id,
                role: OrgRole.MEMBER,
            });
            setMockHeaders(new Headers({ 'Authorization': 'Bearer sboa_oauthtoken' }));

            const authContext = await getAuthContext({ requiredOAuthScopes: [TEST_OAUTH_SCOPE] });

            expect(authContext).toMatchObject({
                user: { id: userId },
                org: MOCK_ORG,
                role: OrgRole.MEMBER,
            });
        });

        test('should return a 403 service error when an OAuth bearer token is missing the required scope', async () => {
            const userId = 'test-user-id';
            mocks.hasEntitlement.mockReturnValue(true);
            const oauthToken = {
                ...MOCK_OAUTH_TOKEN,
                user: { ...MOCK_USER_WITH_ACCOUNTS, id: userId },
                scope: 'other',
            };
            prisma.oAuthToken.findUnique.mockResolvedValue(oauthToken);
            prisma.org.findUnique.mockResolvedValue({ ...MOCK_ORG });
            prisma.userToOrg.findUnique.mockResolvedValue({
                joinedAt: new Date(),
                userId,
                orgId: MOCK_ORG.id,
                role: OrgRole.MEMBER,
            });
            setMockHeaders(new Headers({ 'Authorization': 'Bearer sboa_oauthtoken' }));

            const authContext = await getAuthContext({ requiredOAuthScopes: [TEST_OAUTH_SCOPE] });

            expect(authContext).toStrictEqual({
                statusCode: StatusCodes.FORBIDDEN,
                errorCode: ErrorCode.OAUTH_INSUFFICIENT_SCOPE,
                message: `OAuth access token is missing required scope: ${TEST_OAUTH_SCOPE}`,
            });
        });

        test('should not apply OAuth scope requirements to API keys', async () => {
            const userId = 'test-user-id';
            prisma.user.findUnique.mockResolvedValue({ ...MOCK_USER_WITH_ACCOUNTS, id: userId });
            prisma.org.findUnique.mockResolvedValue({ ...MOCK_ORG });
            prisma.userToOrg.findUnique.mockResolvedValue({
                joinedAt: new Date(),
                userId,
                orgId: MOCK_ORG.id,
                role: OrgRole.MEMBER,
            });
            prisma.apiKey.findUnique.mockResolvedValue({ ...MOCK_API_KEY, hash: 'apikey', createdById: userId });
            setMockHeaders(new Headers({ 'X-Sourcebot-Api-Key': 'sourcebot-apikey' }));

            const authContext = await getAuthContext({ requiredOAuthScopes: [TEST_OAUTH_SCOPE] });

            expect(authContext).toMatchObject({
                user: { id: userId },
                org: MOCK_ORG,
                role: OrgRole.MEMBER,
            });
        });
    });
});

describe('withAuth', () => {
    test('should pass the scoped prisma client from $extends to the callback', async () => {
        const userId = 'test-user-id';
        const user = {
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        };
        const extension = { query: { userMcpServer: {} } };
        const scopedPrisma = { scoped: true };

        prisma.user.findUnique.mockResolvedValue(user);
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        prisma.userToOrg.findUnique.mockResolvedValue({
            joinedAt: new Date(),
            userId,
            orgId: MOCK_ORG.id,
            suspendedAt: null,
            scimExternalId: null,
            lastActiveAt: null,
            role: OrgRole.MEMBER,
        });
        vi.mocked(userScopedPrismaClientExtension).mockResolvedValue(extension as never);
        prisma.$extends.mockReturnValue(scopedPrisma as never);
        setMockSession(createMockSession({ user: { id: userId } }));

        const cb = vi.fn();
        await withAuth(cb);

        expect(userScopedPrismaClientExtension).toHaveBeenCalledWith(user);
        expect(prisma.$extends).toHaveBeenCalledWith(extension);
        expect(cb).toHaveBeenCalledWith(expect.objectContaining({
            prisma: scopedPrisma,
        }));
    });

    test('should call the callback with the auth context object if a valid session is present and the user is a member of the organization', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        prisma.userToOrg.findUnique.mockResolvedValue({
            joinedAt: new Date(),
            userId: userId,
            orgId: MOCK_ORG.id,
            suspendedAt: null,
            scimExternalId: null,
            lastActiveAt: null,
            role: OrgRole.MEMBER,
        });
        setMockSession(createMockSession({ user: { id: 'test-user-id' } }));

        const cb = vi.fn();
        const result = await withAuth(cb);
        expect(cb).toHaveBeenCalledWith({
            user: {
                ...MOCK_USER_WITH_ACCOUNTS,
                id: userId,
            },
            org: MOCK_ORG,
            role: OrgRole.MEMBER
        });
        expect(result).toEqual(undefined);
    });

    test('should call the callback with the auth context object if a valid session is present and the user is a member of the organization with OWNER role', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        prisma.userToOrg.findUnique.mockResolvedValue({
            joinedAt: new Date(),
            userId: userId,
            orgId: MOCK_ORG.id,
            suspendedAt: null,
            scimExternalId: null,
            lastActiveAt: null,
            role: OrgRole.OWNER,
        });
        setMockSession(createMockSession({ user: { id: 'test-user-id' } }));

        const cb = vi.fn();
        const result = await withAuth(cb);
        expect(cb).toHaveBeenCalledWith({
            user: {
                ...MOCK_USER_WITH_ACCOUNTS,
                id: userId,
            },
            org: MOCK_ORG,
            role: OrgRole.OWNER
        });
        expect(result).toEqual(undefined);
    });

    test('should call the callback with the auth context object if a valid session is present and the user is a member of the organization (api key)', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        prisma.userToOrg.findUnique.mockResolvedValue({
            joinedAt: new Date(),
            userId: userId,
            orgId: MOCK_ORG.id,
            suspendedAt: null,
            scimExternalId: null,
            lastActiveAt: null,
            role: OrgRole.MEMBER,
        });
        prisma.apiKey.findUnique.mockResolvedValue({
            ...MOCK_API_KEY,
            hash: 'apikey',
            createdById: userId,
        });
        setMockHeaders(new Headers({ 'X-Sourcebot-Api-Key': 'sourcebot-apikey' }));

        const cb = vi.fn();
        const result = await withAuth(cb);
        expect(cb).toHaveBeenCalledWith({
            user: {
                ...MOCK_USER_WITH_ACCOUNTS,
                id: userId,
            },
            org: MOCK_ORG,
            role: OrgRole.MEMBER
        });
        expect(result).toEqual(undefined);
    });

    test('should call the callback with the auth context object if a valid session is present and the user is a member of the organization with OWNER role (api key)', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        prisma.userToOrg.findUnique.mockResolvedValue({
            joinedAt: new Date(),
            userId: userId,
            orgId: MOCK_ORG.id,
            suspendedAt: null,
            scimExternalId: null,
            lastActiveAt: null,
            role: OrgRole.OWNER,
        });
        prisma.apiKey.findUnique.mockResolvedValue({
            ...MOCK_API_KEY,
            hash: 'apikey',
            createdById: userId,
        });
        setMockHeaders(new Headers({ 'X-Sourcebot-Api-Key': 'sourcebot-apikey' }));

        const cb = vi.fn();
        const result = await withAuth(cb);
        expect(cb).toHaveBeenCalledWith({
            user: {
                ...MOCK_USER_WITH_ACCOUNTS,
                id: userId,
            },
            org: MOCK_ORG,
            role: OrgRole.OWNER
        });
        expect(result).toEqual(undefined);
    });

    test('should call the callback with the auth context object if a valid Bearer token is present and the user is a member of the organization', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        prisma.userToOrg.findUnique.mockResolvedValue({
            joinedAt: new Date(),
            userId: userId,
            orgId: MOCK_ORG.id,
            suspendedAt: null,
            scimExternalId: null,
            lastActiveAt: null,
            role: OrgRole.MEMBER,
        });
        prisma.apiKey.findUnique.mockResolvedValue({
            ...MOCK_API_KEY,
            hash: 'apikey',
            createdById: userId,
        });
        setMockHeaders(new Headers({ 'Authorization': 'Bearer sourcebot-apikey' }));

        const cb = vi.fn();
        const result = await withAuth(cb);
        expect(cb).toHaveBeenCalledWith({
            user: {
                ...MOCK_USER_WITH_ACCOUNTS,
                id: userId,
            },
            org: MOCK_ORG,
            role: OrgRole.MEMBER
        });
        expect(result).toEqual(undefined);
    });

    test('should call the callback with the auth context object if a valid Bearer token is present and the user is a member of the organization with OWNER role', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        prisma.userToOrg.findUnique.mockResolvedValue({
            joinedAt: new Date(),
            userId: userId,
            orgId: MOCK_ORG.id,
            suspendedAt: null,
            scimExternalId: null,
            lastActiveAt: null,
            role: OrgRole.OWNER,
        });
        prisma.apiKey.findUnique.mockResolvedValue({
            ...MOCK_API_KEY,
            hash: 'apikey',
            createdById: userId,
        });
        setMockHeaders(new Headers({ 'Authorization': 'Bearer sourcebot-apikey' }));

        const cb = vi.fn();
        const result = await withAuth(cb);
        expect(cb).toHaveBeenCalledWith({
            user: {
                ...MOCK_USER_WITH_ACCOUNTS,
                id: userId,
            },
            org: MOCK_ORG,
            role: OrgRole.OWNER
        });
        expect(result).toEqual(undefined);
    });

    test('should return a service error if the user is a member of the organization but does not have a valid session', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        prisma.userToOrg.findUnique.mockResolvedValue({
            joinedAt: new Date(),
            userId: userId,
            orgId: MOCK_ORG.id,
            suspendedAt: null,
            scimExternalId: null,
            lastActiveAt: null,
            role: OrgRole.MEMBER,
        });
        setMockSession(null);

        const cb = vi.fn();
        const result = await withAuth(cb);
        expect(cb).not.toHaveBeenCalled();
        expect(result).toStrictEqual(notAuthenticated());
    });

    test('should return a service error if the user is not a member of the organization', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        // user is not a member of the organization
        setMockSession(createMockSession({ user: { id: 'test-user-id' } }));

        const cb = vi.fn();
        const result = await withAuth(cb);
        expect(cb).not.toHaveBeenCalled();
        expect(result).toStrictEqual(notAuthenticated());
    });

    test('should return a service error when the membership is suspended, even with a valid session', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        prisma.userToOrg.findUnique.mockResolvedValue({
            joinedAt: new Date(),
            userId: userId,
            orgId: MOCK_ORG.id,
            suspendedAt: SUSPENDED_AT,
            scimExternalId: null,
            lastActiveAt: null,
            role: OrgRole.OWNER,
        });
        setMockSession(createMockSession({ user: { id: userId } }));

        const cb = vi.fn();
        const result = await withAuth(cb);
        expect(cb).not.toHaveBeenCalled();
        expect(result).toStrictEqual(notAuthenticated());
    });

    test('should deny a suspended member authenticating via API key', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        prisma.userToOrg.findUnique.mockResolvedValue({
            joinedAt: new Date(),
            userId: userId,
            orgId: MOCK_ORG.id,
            suspendedAt: SUSPENDED_AT,
            scimExternalId: null,
            lastActiveAt: null,
            role: OrgRole.MEMBER,
        });
        prisma.apiKey.findUnique.mockResolvedValue({
            ...MOCK_API_KEY,
            hash: 'apikey',
            createdById: userId,
        });
        setMockHeaders(new Headers({ 'X-Sourcebot-Api-Key': 'sourcebot-apikey' }));

        const cb = vi.fn();
        const result = await withAuth(cb);
        expect(cb).not.toHaveBeenCalled();
        expect(result).toStrictEqual(notAuthenticated());
    });
});

describe('withOptionalAuth', () => {
    test('should call the callback with the auth context object if a valid session is present and the user is a member of the organization', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        prisma.userToOrg.findUnique.mockResolvedValue({
            joinedAt: new Date(),
            userId: userId,
            orgId: MOCK_ORG.id,
            suspendedAt: null,
            scimExternalId: null,
            lastActiveAt: null,
            role: OrgRole.MEMBER,
        });
        setMockSession(createMockSession({ user: { id: 'test-user-id' } }));

        const cb = vi.fn();
        const result = await withOptionalAuth(cb);
        expect(cb).toHaveBeenCalledWith({
            user: {
                ...MOCK_USER_WITH_ACCOUNTS,
                id: userId,
            },
            org: MOCK_ORG,
            role: OrgRole.MEMBER
        });
        expect(result).toEqual(undefined);
    });

    test('should call the callback with the auth context object if a valid session is present and the user is a member of the organization with OWNER role', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        prisma.userToOrg.findUnique.mockResolvedValue({
            joinedAt: new Date(),
            userId: userId,
            orgId: MOCK_ORG.id,
            suspendedAt: null,
            scimExternalId: null,
            lastActiveAt: null,
            role: OrgRole.OWNER,
        });
        setMockSession(createMockSession({ user: { id: 'test-user-id' } }));

        const cb = vi.fn();
        const result = await withOptionalAuth(cb);
        expect(cb).toHaveBeenCalledWith({
            user: {
                ...MOCK_USER_WITH_ACCOUNTS,
                id: userId,
            },
            org: MOCK_ORG,
            role: OrgRole.OWNER
        });
        expect(result).toEqual(undefined);
    });

    test('should call the callback with the auth context object if a valid session is present and the user is a member of the organization (api key)', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        prisma.userToOrg.findUnique.mockResolvedValue({
            joinedAt: new Date(),
            userId: userId,
            orgId: MOCK_ORG.id,
            suspendedAt: null,
            scimExternalId: null,
            lastActiveAt: null,
            role: OrgRole.MEMBER,
        });
        prisma.apiKey.findUnique.mockResolvedValue({
            ...MOCK_API_KEY,
            hash: 'apikey',
            createdById: userId,
        });
        setMockHeaders(new Headers({ 'X-Sourcebot-Api-Key': 'sourcebot-apikey' }));

        const cb = vi.fn();
        const result = await withOptionalAuth(cb);
        expect(cb).toHaveBeenCalledWith({
            user: {
                ...MOCK_USER_WITH_ACCOUNTS,
                id: userId,
            },
            org: MOCK_ORG,
            role: OrgRole.MEMBER
        });
        expect(result).toEqual(undefined);
    });

    test('should call the callback with the auth context object if a valid session is present and the user is a member of the organization with OWNER role (api key)', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        prisma.userToOrg.findUnique.mockResolvedValue({
            joinedAt: new Date(),
            userId: userId,
            orgId: MOCK_ORG.id,
            suspendedAt: null,
            scimExternalId: null,
            lastActiveAt: null,
            role: OrgRole.OWNER,
        });
        prisma.apiKey.findUnique.mockResolvedValue({
            ...MOCK_API_KEY,
            hash: 'apikey',
            createdById: userId,
        });
        setMockHeaders(new Headers({ 'X-Sourcebot-Api-Key': 'sourcebot-apikey' }));

        const cb = vi.fn();
        const result = await withOptionalAuth(cb);
        expect(cb).toHaveBeenCalledWith({
            user: {
                ...MOCK_USER_WITH_ACCOUNTS,
                id: userId,
            },
            org: MOCK_ORG,
            role: OrgRole.OWNER
        });
        expect(result).toEqual(undefined);
    });

    test('should call the callback with the auth context object if a valid Bearer token is present and the user is a member of the organization', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        prisma.userToOrg.findUnique.mockResolvedValue({
            joinedAt: new Date(),
            userId: userId,
            orgId: MOCK_ORG.id,
            suspendedAt: null,
            scimExternalId: null,
            lastActiveAt: null,
            role: OrgRole.MEMBER,
        });
        prisma.apiKey.findUnique.mockResolvedValue({
            ...MOCK_API_KEY,
            hash: 'apikey',
            createdById: userId,
        });
        setMockHeaders(new Headers({ 'Authorization': 'Bearer sourcebot-apikey' }));

        const cb = vi.fn();
        const result = await withOptionalAuth(cb);
        expect(cb).toHaveBeenCalledWith({
            user: {
                ...MOCK_USER_WITH_ACCOUNTS,
                id: userId,
            },
            org: MOCK_ORG,
            role: OrgRole.MEMBER
        });
        expect(result).toEqual(undefined);
    });

    test('should call the callback with the auth context object if a valid Bearer token is present and the user is a member of the organization with OWNER role', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        prisma.userToOrg.findUnique.mockResolvedValue({
            joinedAt: new Date(),
            userId: userId,
            orgId: MOCK_ORG.id,
            suspendedAt: null,
            scimExternalId: null,
            lastActiveAt: null,
            role: OrgRole.OWNER,
        });
        prisma.apiKey.findUnique.mockResolvedValue({
            ...MOCK_API_KEY,
            hash: 'apikey',
            createdById: userId,
        });
        setMockHeaders(new Headers({ 'Authorization': 'Bearer sourcebot-apikey' }));

        const cb = vi.fn();
        const result = await withOptionalAuth(cb);
        expect(cb).toHaveBeenCalledWith({
            user: {
                ...MOCK_USER_WITH_ACCOUNTS,
                id: userId,
            },
            org: MOCK_ORG,
            role: OrgRole.OWNER
        });
        expect(result).toEqual(undefined);
    });

    test('should return a service error if the user is a member of the organization but does not have a valid session', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        prisma.userToOrg.findUnique.mockResolvedValue({
            joinedAt: new Date(),
            userId: userId,
            orgId: MOCK_ORG.id,
            suspendedAt: null,
            scimExternalId: null,
            lastActiveAt: null,
            role: OrgRole.MEMBER,
        });
        setMockSession(null);

        const cb = vi.fn();
        const result = await withOptionalAuth(cb);
        expect(cb).not.toHaveBeenCalled();
        expect(result).toStrictEqual(notAuthenticated());
    });

    test('should return a service error if the user is not a member of the organization', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        // user is not a member of the organization
        setMockSession(createMockSession({ user: { id: 'test-user-id' } }));

        const cb = vi.fn();
        const result = await withOptionalAuth(cb);
        expect(cb).not.toHaveBeenCalled();
        expect(result).toStrictEqual(notAuthenticated());
    });

    test('should call the callback with the auth context object if the user is not a member of the organization and anonymous access is available', async () => {
        mocks.isAnonymousAccessAvailable.mockReturnValue(true);

        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
            isAnonymousAccessEnabled: true,
        });
        setMockSession(createMockSession({ user: { id: 'test-user-id' } }));

        const cb = vi.fn();
        const result = await withOptionalAuth(cb);
        expect(cb).toHaveBeenCalledWith({
            user: {
                ...MOCK_USER_WITH_ACCOUNTS,
                id: userId,
            },
            org: {
                ...MOCK_ORG,
                isAnonymousAccessEnabled: true,
            },
            prisma: undefined,
        });
        expect(result).toEqual(undefined);
    });

    test('should return a service error when anonymousAccessEnabled is true but anonymous access is not available', async () => {
        mocks.isAnonymousAccessAvailable.mockReturnValue(false);

        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
            isAnonymousAccessEnabled: true,
        });
        setMockSession(createMockSession({ user: { id: 'test-user-id' } }));

        const cb = vi.fn();
        const result = await withOptionalAuth(cb);
        expect(cb).not.toHaveBeenCalled();
        expect(result).toStrictEqual(notAuthenticated());
    });

    test('should return a service error when anonymous access is available but anonymousAccessEnabled is false', async () => {
        mocks.isAnonymousAccessAvailable.mockReturnValue(true);

        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
            isAnonymousAccessEnabled: false,
        });
        setMockSession(createMockSession({ user: { id: 'test-user-id' } }));

        const cb = vi.fn();
        const result = await withOptionalAuth(cb);
        expect(cb).not.toHaveBeenCalled();
        expect(result).toStrictEqual(notAuthenticated());
    });
});
