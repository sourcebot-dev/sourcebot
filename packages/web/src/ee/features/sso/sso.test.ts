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
    AZURE_DEVOPS_OAUTH_SCOPE: 'openid profile email offline_access 499b84ac-1321-427f-aa17-267ca6975798/.default',
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
    test.each(['sso', 'account_linking'])('supports Azure DevOps %s through tenant-scoped Entra OAuth', async (purpose) => {
        mocks.getIdentityProviderConfigs.mockResolvedValue({
            'ado-corp': {
                provider: 'azuredevops', purpose, tenantId: 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE',
                clientId: { env: 'ADO_CLIENT_ID' }, clientSecret: { env: 'ADO_CLIENT_SECRET' },
                accountLinkingRequired: true,
            },
        });
        mocks.getTokenFromConfig.mockImplementation(async ({ env }) => env);
        const [provider] = await getEEIdentityProviders();
        expect(provider).toMatchObject({
            id: 'ado-corp', type: 'azuredevops', purpose, required: true,
            issuerUrl: 'https://dev.azure.com',
            __provider: {
                id: 'ado-corp', type: 'oidc',
                issuer: 'https://login.microsoftonline.com/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/v2.0',
                checks: ['pkce', 'state', 'nonce'],
                authorization: { params: { scope: 'openid profile email offline_access 499b84ac-1321-427f-aa17-267ca6975798/.default' } },
                allowDangerousEmailAccountLinking: false,
            },
        });
        const oauth = provider.__provider;
        if (typeof oauth === 'function' || oauth.type !== 'oidc') {
            throw new Error('Expected OIDC provider');
        }
        expect(await oauth.profile!({ sub: 'subject', name: 'Alice', email: 'alice@example.com' }, {})).toEqual({
            id: 'subject', name: 'Alice', email: 'alice@example.com', image: null,
        });
    });
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
