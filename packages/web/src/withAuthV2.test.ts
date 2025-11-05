import { expect, test, vi, beforeEach, describe } from 'vitest';
import { Session } from 'next-auth';
import { notAuthenticated } from './lib/serviceError';
import { getAuthContext, getAuthenticatedUser, withAuthV2, withOptionalAuthV2 } from './withAuthV2';
import { MOCK_API_KEY, MOCK_ORG, MOCK_USER_WITH_ACCOUNTS, prisma } from './__mocks__/prisma';
import { OrgRole } from '@sourcebot/db';

const mocks = vi.hoisted(() => {
    return {
        // Defaults to a empty session.
        auth: vi.fn(async (): Promise<Session | null> => null),
        headers: vi.fn(async (): Promise<Headers> => new Headers()),
        hasEntitlement: vi.fn((_entitlement: string) => false),
    }
});

vi.mock('./auth', () => ({
    auth: mocks.auth,
}));

vi.mock('@/env.mjs', () => ({
    env: {}
}));

vi.mock('next/headers', () => ({
    headers: mocks.headers,
}));

vi.mock('@/env.mjs', () => ({
    env: {}
}));

vi.mock('@/prisma', async () => {
    // @see: https://github.com/prisma/prisma/discussions/20244#discussioncomment-7976447
    const actual = await vi.importActual<typeof import('@/__mocks__/prisma')>('@/__mocks__/prisma');
    return {
        ...actual,
    };
});

vi.mock('@sourcebot/crypto', () => ({
    hashSecret: vi.fn((secret: string) => secret),
}));

vi.mock('server-only', () => ({
    default: vi.fn(),
}));

vi.mock('@sourcebot/shared', () => ({
    hasEntitlement: mocks.hasEntitlement,
}));

// Test utility to set the mock session
const setMockSession = (session: Session | null) => {
    mocks.auth.mockResolvedValue(session);
};

const setMockHeaders = (headers: Headers) => {
    mocks.headers.mockResolvedValue(headers);
};

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
    mocks.auth.mockResolvedValue(null);
    mocks.headers.mockResolvedValue(new Headers());
});

describe('getAuthenticatedUser', () => {
    test('should return a user object if a valid session is present', async () => {
        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        setMockSession(createMockSession({ user: { id: 'test-user-id' } }));
        const user = await getAuthenticatedUser();
        expect(user).not.toBeUndefined();
        expect(user?.id).toBe(userId);
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
        const user = await getAuthenticatedUser();
        expect(user).not.toBeUndefined();
        expect(user?.id).toBe(userId);
        expect(prisma.apiKey.update).toHaveBeenCalledWith({
            where: {
                hash: 'apikey',
            },
            data: {
                lastUsedAt: expect.any(Date),
            },
        });
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

    test('should return a auth context object if a valid session is present and the user is not a member of the organization. The role should be GUEST.', async () => {
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
            role: OrgRole.GUEST,
            prisma: undefined,
        });
    });

    test('should return a auth context object if no auth session is present. The role should be GUEST and the user should be undefined.', async () => {
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
        });
        prisma.userToOrg.findUnique.mockResolvedValue(null);

        const authContext = await getAuthContext();
        expect(authContext).not.toBeUndefined();
        expect(authContext).toStrictEqual({
            user: undefined,
            org: MOCK_ORG,
            role: OrgRole.GUEST,
            prisma: undefined,
        });
    });
});

describe('withAuthV2', () => {
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
            role: OrgRole.MEMBER,
        });
        setMockSession(createMockSession({ user: { id: 'test-user-id' } }));

        const cb = vi.fn();
        const result = await withAuthV2(cb);
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
            role: OrgRole.OWNER,
        });
        setMockSession(createMockSession({ user: { id: 'test-user-id' } }));

        const cb = vi.fn();
        const result = await withAuthV2(cb);
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
            role: OrgRole.MEMBER,
        });
        prisma.apiKey.findUnique.mockResolvedValue({
            ...MOCK_API_KEY,
            hash: 'apikey',
            createdById: userId,
        });
        setMockHeaders(new Headers({ 'X-Sourcebot-Api-Key': 'sourcebot-apikey' }));

        const cb = vi.fn();
        const result = await withAuthV2(cb);
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
            role: OrgRole.OWNER,
        });
        prisma.apiKey.findUnique.mockResolvedValue({
            ...MOCK_API_KEY,
            hash: 'apikey',
            createdById: userId,
        });
        setMockHeaders(new Headers({ 'X-Sourcebot-Api-Key': 'sourcebot-apikey' }));

        const cb = vi.fn();
        const result = await withAuthV2(cb);
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
            role: OrgRole.MEMBER,
        });
        setMockSession(null);

        const cb = vi.fn();
        const result = await withAuthV2(cb);
        expect(cb).not.toHaveBeenCalled();
        expect(result).toStrictEqual(notAuthenticated());
    });

    test('should return a service error if the user is a guest of the organization', async () => {
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
            role: OrgRole.GUEST,
        });
        setMockSession(createMockSession({ user: { id: 'test-user-id' } }));

        const cb = vi.fn();
        const result = await withAuthV2(cb);
        expect(cb).not.toHaveBeenCalled();
        expect(result).toStrictEqual(notAuthenticated());
    });


    test('should return a service error if the user is not a member of the organization (guest role)', async () => {
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
        const result = await withAuthV2(cb);
        expect(cb).not.toHaveBeenCalled();
        expect(result).toStrictEqual(notAuthenticated());
    });
});

describe('withOptionalAuthV2', () => {
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
            role: OrgRole.MEMBER,
        });
        setMockSession(createMockSession({ user: { id: 'test-user-id' } }));

        const cb = vi.fn();
        const result = await withOptionalAuthV2(cb);
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
            role: OrgRole.OWNER,
        });
        setMockSession(createMockSession({ user: { id: 'test-user-id' } }));

        const cb = vi.fn();
        const result = await withOptionalAuthV2(cb);
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
            role: OrgRole.MEMBER,
        });
        prisma.apiKey.findUnique.mockResolvedValue({
            ...MOCK_API_KEY,
            hash: 'apikey',
            createdById: userId,
        });
        setMockHeaders(new Headers({ 'X-Sourcebot-Api-Key': 'sourcebot-apikey' }));

        const cb = vi.fn();
        const result = await withOptionalAuthV2(cb);
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
            role: OrgRole.OWNER,
        });
        prisma.apiKey.findUnique.mockResolvedValue({
            ...MOCK_API_KEY,
            hash: 'apikey',
            createdById: userId,
        });
        setMockHeaders(new Headers({ 'X-Sourcebot-Api-Key': 'sourcebot-apikey' }));

        const cb = vi.fn();
        const result = await withOptionalAuthV2(cb);
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
            role: OrgRole.MEMBER,
        });
        setMockSession(null);

        const cb = vi.fn();
        const result = await withOptionalAuthV2(cb);
        expect(cb).not.toHaveBeenCalled();
        expect(result).toStrictEqual(notAuthenticated());
    });

    test('should return a service error if the user is a guest of the organization', async () => {
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
            role: OrgRole.GUEST,
        });
        setMockSession(createMockSession({ user: { id: 'test-user-id' } }));

        const cb = vi.fn();
        const result = await withOptionalAuthV2(cb);
        expect(cb).not.toHaveBeenCalled();
        expect(result).toStrictEqual(notAuthenticated());
    });


    test('should return a service error if the user is not a member of the organization (guest role)', async () => {
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
        const result = await withOptionalAuthV2(cb);
        expect(cb).not.toHaveBeenCalled();
        expect(result).toStrictEqual(notAuthenticated());
    });

    test('should call the callback with the auth context object if the user is a guest of the organization and the anonymous access entitlement is enabled', async () => {
        mocks.hasEntitlement.mockReturnValue(true);

        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
            metadata: {
                anonymousAccessEnabled: true,
            },
        });
        setMockSession(createMockSession({ user: { id: 'test-user-id' } }));

        const cb = vi.fn();
        const result = await withOptionalAuthV2(cb);
        expect(cb).toHaveBeenCalledWith({
            user: {
                ...MOCK_USER_WITH_ACCOUNTS,
                id: userId,
            },
            org: {
                ...MOCK_ORG,
                metadata: {
                    anonymousAccessEnabled: true,
                },
            },
            role: OrgRole.GUEST,
        });
        expect(result).toEqual(undefined);
    });

    test('should return a service error when anonymousAccessEnabled is true but hasAnonymousAccessEntitlement is false', async () => {
        mocks.hasEntitlement.mockReturnValue(false);

        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
            metadata: {
                anonymousAccessEnabled: true,
            },
        });
        setMockSession(createMockSession({ user: { id: 'test-user-id' } }));

        const cb = vi.fn();
        const result = await withOptionalAuthV2(cb);
        expect(cb).not.toHaveBeenCalled();
        expect(result).toStrictEqual(notAuthenticated());
    });

    test('should return a service error when hasAnonymousAccessEntitlement is true but anonymousAccessEnabled is false', async () => {
        mocks.hasEntitlement.mockReturnValue(true);

        const userId = 'test-user-id';
        prisma.user.findUnique.mockResolvedValue({
            ...MOCK_USER_WITH_ACCOUNTS,
            id: userId,
        });
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
            metadata: {
                anonymousAccessEnabled: false,
            },
        });
        setMockSession(createMockSession({ user: { id: 'test-user-id' } }));

        const cb = vi.fn();
        const result = await withOptionalAuthV2(cb);
        expect(cb).not.toHaveBeenCalled();
        expect(result).toStrictEqual(notAuthenticated());
    });
});
