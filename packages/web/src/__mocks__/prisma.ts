import { SINGLE_TENANT_ORG_ID, SINGLE_TENANT_ORG_NAME } from '@/lib/constants';
import { Account, ApiKey, OAuthRefreshToken, OAuthToken, Org, PrismaClient, User } from '@prisma/client';
import { beforeEach, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

beforeEach(() => {
    mockReset(prisma);
});

export const prisma = mockDeep<PrismaClient>();
export const __unsafePrisma = prisma;

export const MOCK_ORG: Org = {
    id: SINGLE_TENANT_ORG_ID,
    name: SINGLE_TENANT_ORG_NAME,
    createdAt: new Date(),
    updatedAt: new Date(),
    isOnboarded: true,
    imageUrl: null,
    metadata: null,
    memberApprovalRequired: false,
    inviteLinkEnabled: false,
    inviteLinkId: null
}

export const MOCK_API_KEY: ApiKey = {
    name: 'Test API Key',
    hash: 'apikey',
    createdAt: new Date(),
    lastUsedAt: new Date(),
    orgId: 1,
    createdById: '1',
}

export const MOCK_USER_WITH_ACCOUNTS: User & { accounts: Account[] } = {
    id: '1',
    name: 'Test User',
    email: 'test@test.com',
    createdAt: new Date(),
    updatedAt: new Date(),
    hashedPassword: null,
    emailVerified: null,
    image: null,
    sessionVersion: 0,
    accounts: [],
}

export const MOCK_OAUTH_TOKEN: OAuthToken & { user: User & { accounts: Account[] } } = {
    hash: 'oauthtoken',
    clientId: 'test-client-id',
    userId: MOCK_USER_WITH_ACCOUNTS.id,
    scope: '',
    resource: null,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour from now
    createdAt: new Date(),
    lastUsedAt: null,
    user: MOCK_USER_WITH_ACCOUNTS,
}

export const MOCK_REFRESH_TOKEN: OAuthRefreshToken = {
    hash: 'refreshtoken',
    clientId: 'test-client-id',
    userId: MOCK_USER_WITH_ACCOUNTS.id,
    scope: '',
    resource: null,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90), // 90 days from now
    createdAt: new Date(),
}

export const userScopedPrismaClientExtension = vi.fn();