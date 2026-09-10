import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getIdentityProviderConfigs: vi.fn(),
    getTokenFromConfig: vi.fn(),
}));

vi.mock('@/prisma', () => ({
    __unsafePrisma: {},
}));
vi.mock('@/lib/entitlements', () => ({
    hasEntitlement: vi.fn(),
}));
vi.mock('@/features/membership/onCreateUser', () => ({
    onCreateUser: vi.fn(),
}));
vi.mock('@sourcebot/shared', () => ({
    createLogger: () => ({ warn: vi.fn() }),
    env: { AUTH_EE_ALLOW_EMAIL_ACCOUNT_LINKING: 'false' },
    getIdentityProviderConfigs: mocks.getIdentityProviderConfigs,
    getTokenFromConfig: mocks.getTokenFromConfig,
}));

const { getEEIdentityProviders } = await import('./sso');

beforeEach(() => {
    vi.clearAllMocks();
});

describe('getEEIdentityProviders', () => {
    test('preserves the configured Idira issuer trailing slash', async () => {
        const clientId = { env: 'IDIRA_CLIENT_ID' };
        const clientSecret = { env: 'IDIRA_CLIENT_SECRET' };
        const issuerConfig = { env: 'IDIRA_ISSUER' };
        const issuer = 'https://example.id.cyberark.cloud/sourcebot/';

        mocks.getIdentityProviderConfigs.mockResolvedValue({
            idira: {
                provider: 'idira',
                purpose: 'sso',
                clientId,
                clientSecret,
                issuer: issuerConfig,
            },
        });
        mocks.getTokenFromConfig.mockImplementation(async (token) => {
            if (token === clientId) {
                return 'client-id';
            }
            if (token === clientSecret) {
                return 'client-secret';
            }
            if (token === issuerConfig) {
                return issuer;
            }
            throw new Error('Unexpected token config');
        });

        const providers = await getEEIdentityProviders();

        expect(providers).toHaveLength(1);
        expect(providers[0].issuerUrl).toBe(issuer);
        expect(providers[0].__provider).toMatchObject({ issuer });
    });
});
