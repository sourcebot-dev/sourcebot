import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { ComponentProps, ReactElement } from 'react';
import { OPTIONAL_PROVIDERS_LINK_SKIPPED_COOKIE_NAME } from '@/lib/constants';
import { ServiceErrorException } from '@/lib/serviceError';

const mocks = vi.hoisted(() => ({
    auth: vi.fn(), hasEntitlement: vi.fn(), findUnique: vi.fn(), getLinkedAccounts: vi.fn(),
    connectAccountsCard: vi.fn(), consentScreen: vi.fn(),
    cookieGet: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/entitlements', () => ({ hasEntitlement: mocks.hasEntitlement }));
vi.mock('@/prisma', () => ({ __unsafePrisma: { oAuthClient: { findUnique: mocks.findUnique } } }));
vi.mock('@/ee/features/sso/actions', () => ({ getLinkedAccounts: mocks.getLinkedAccounts }));
vi.mock('@/ee/features/oauth/dpop', () => ({ isValidDpopJkt: () => true }));
vi.mock('@/lib/utils', () => ({
    isServiceError: (value: unknown) => !!value && typeof value === 'object' && 'errorCode' in value,
}));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(url); } }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.cookieGet }) }));
vi.mock('@/app/components/logoutEscapeHatch', () => ({ LogoutEscapeHatch: () => null }));
vi.mock('@/ee/features/sso/components/connectAccountsCard', () => ({
    ConnectAccountsCard: (props: unknown) => { mocks.connectAccountsCard(props); return <div>Link accounts</div>; },
}));
vi.mock('./components/consentScreen', () => ({
    ConsentScreen: (props: unknown) => { mocks.consentScreen(props); return <div>OAuth consent</div>; },
}));

const { default: AuthorizePage } = await import('./page');
const { AccountLinkingGuard } = await import('@/ee/features/sso/components/accountLinkingGuard');
type Params = Awaited<ComponentProps<typeof AuthorizePage>['searchParams']>;

// Resolve the async server guard before rendering its client-visible output.
const renderPage = async (requestParams: Params) => {
    const page = await AuthorizePage({ searchParams: Promise.resolve(requestParams) });
    if (page.type === AccountLinkingGuard) {
        const guard = page as ReactElement<ComponentProps<typeof AccountLinkingGuard>>;
        return render(await AccountLinkingGuard(guard.props));
    }
    return render(page);
};

const params: Params = {
    client_id: 'client-1', redirect_uri: 'https://client.example/callback?foo=bar',
    code_challenge: 'original-challenge', code_challenge_method: 'S256', response_type: 'code',
    state: 'state with + & = ?', scope: '',
    resource: ['https://sourcebot.example/api/mcp', 'https://second.example/mcp'],
    dpop_jkt: 'original-thumbprint',
};
const requiredAccount = {
    providerId: 'github', providerType: 'github', isLinked: false,
    isAccountLinkingProvider: true, required: true, supportsPermissionSync: true,
};

beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: 'user-1', email: 'user@example.com' } });
    mocks.hasEntitlement.mockResolvedValue(true);
    mocks.findUnique.mockResolvedValue({ name: 'Client', logoUri: null, redirectUris: [params.redirect_uri] });
    mocks.getLinkedAccounts.mockResolvedValue([requiredAccount]);
    mocks.cookieGet.mockReturnValue(undefined);
});
afterEach(cleanup);

describe('OAuth linking screen', () => {
    test('shows linking before consent and resumes the original request after linking', async () => {
        await renderPage(params);
        expect(screen.queryByText('Link accounts')).not.toBeNull();
        expect(mocks.consentScreen).not.toHaveBeenCalled();
        const { callbackUrl } = mocks.connectAccountsCard.mock.calls[0][0];
        const url = new URL(callbackUrl, 'https://sourcebot.example');
        expect(url.pathname).toBe('/oauth/authorize');
        for (const [key, value] of Object.entries(params)) {
            expect(url.searchParams.getAll(key)).toEqual(Array.isArray(value) ? value : [value]);
        }

        const resumedParams: Record<string, string | string[]> = {};
        for (const key of url.searchParams.keys()) {
            const values = url.searchParams.getAll(key);
            resumedParams[key] = values.length === 1 ? values[0] : values;
        }
        cleanup();
        mocks.getLinkedAccounts.mockResolvedValue([{ ...requiredAccount, isLinked: true }]);
        await renderPage(resumedParams);
        expect(screen.queryByText('OAuth consent')).not.toBeNull();
        expect(mocks.consentScreen).toHaveBeenCalledWith(expect.objectContaining({
            codeChallenge: params.code_challenge, state: params.state, requestedScope: params.scope,
            redirectUri: params.redirect_uri, resource: params.resource![0], dpopJkt: params.dpop_jkt,
        }));
    });

    test('preserves repeated parameters through the login callback too', async () => {
        mocks.auth.mockResolvedValue(null);
        let redirectUrl = '';
        try {
            await AuthorizePage({ searchParams: Promise.resolve({ ...params, scope: undefined }) });
        } catch (error) {
            redirectUrl = (error as Error).message;
        }
        const login = new URL(redirectUrl, 'https://sourcebot.example');
        expect(login.pathname).toBe('/login');
        const callback = new URL(login.searchParams.get('callbackUrl')!, 'https://sourcebot.example');
        expect(callback.searchParams.getAll('resource')).toEqual(params.resource);
        expect(callback.searchParams.get('state')).toBe(params.state);
        expect(callback.searchParams.has('scope')).toBe(false);
        expect(mocks.getLinkedAccounts).not.toHaveBeenCalled();
    });

    test('shows optional providers and resumes consent after they are skipped', async () => {
        mocks.getLinkedAccounts.mockResolvedValue([{ ...requiredAccount, required: false }]);
        await renderPage(params);
        expect(screen.queryByText('Link accounts')).not.toBeNull();
        expect(mocks.consentScreen).not.toHaveBeenCalled();
        expect(mocks.cookieGet).toHaveBeenCalledWith(OPTIONAL_PROVIDERS_LINK_SKIPPED_COOKIE_NAME);

        cleanup();
        mocks.cookieGet.mockReturnValue({ value: JSON.stringify(['github']) });
        await renderPage(params);
        expect(screen.queryByText('OAuth consent')).not.toBeNull();
        expect(mocks.consentScreen).toHaveBeenCalledWith(expect.objectContaining({
            state: params.state, codeChallenge: params.code_challenge, redirectUri: params.redirect_uri,
        }));
    });

    test('the optional skip cookie does not bypass required account linking', async () => {
        mocks.cookieGet.mockReturnValue({ value: JSON.stringify(['github']) });
        await renderPage(params);
        expect(screen.queryByText('Link accounts')).not.toBeNull();
        expect(mocks.consentScreen).not.toHaveBeenCalled();
    });

    test.each([
        ['linked providers', [{ ...requiredAccount, isLinked: true }]],
        ['SSO providers', [{ ...requiredAccount, isAccountLinkingProvider: false }]],
        ['no providers', []],
    ])('goes directly to consent with %s', async (_name, accounts) => {
        mocks.getLinkedAccounts.mockResolvedValue(accounts);
        await renderPage(params);
        expect(screen.queryByText('OAuth consent')).not.toBeNull();
        expect(mocks.connectAccountsCard).not.toHaveBeenCalled();
    });

    test('skips account linking without the SSO entitlement', async () => {
        mocks.hasEntitlement.mockImplementation(async (name) => name !== 'sso');
        await renderPage(params);
        expect(screen.queryByText('OAuth consent')).not.toBeNull();
        expect(mocks.getLinkedAccounts).not.toHaveBeenCalled();
    });

    test('throws to the error boundary instead of showing consent if account lookup fails', async () => {
        const error = { statusCode: 500, errorCode: 'UNEXPECTED_ERROR', message: 'Lookup failed' };
        mocks.getLinkedAccounts.mockResolvedValue(error);
        await expect(renderPage(params)).rejects.toEqual(new ServiceErrorException(error));
        expect(mocks.consentScreen).not.toHaveBeenCalled();
    });

    test('validates the OAuth client before starting account linking', async () => {
        mocks.findUnique.mockResolvedValue(null);
        await renderPage(params);
        expect(screen.queryByText('Authorization Error')).not.toBeNull();
        expect(mocks.getLinkedAccounts).not.toHaveBeenCalled();
    });
});
