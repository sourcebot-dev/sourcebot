import { beforeEach, expect, test, vi } from 'vitest';
import { ServiceErrorException } from '@/lib/serviceError';
import type { LinkedAccount } from '../types';

const mocks = vi.hoisted(() => ({
    auth: vi.fn(), hasEntitlement: vi.fn(), getLinkedAccounts: vi.fn(), cookieGet: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/entitlements', () => ({ hasEntitlement: mocks.hasEntitlement }));
vi.mock('@/ee/features/sso/actions', () => ({ getLinkedAccounts: mocks.getLinkedAccounts }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.cookieGet }) }));
vi.mock('@/lib/utils', () => ({
    isServiceError: (value: unknown) => !!value && typeof value === 'object' && 'errorCode' in value,
}));
vi.mock('@/app/components/logoutEscapeHatch', () => ({ LogoutEscapeHatch: () => null }));
vi.mock('./connectAccountsCard', () => ({ ConnectAccountsCard: () => null }));

const { AccountLinkingGuard } = await import('./accountLinkingGuard');
const children = <div>App content</div>;
const props = { children, callbackUrl: '/' };
const optionalAccount: LinkedAccount = {
    providerId: 'github-personal',
    providerType: 'github',
    isLinked: false,
    isAccountLinkingProvider: true,
    required: false,
    supportsPermissionSync: true,
};

beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.hasEntitlement.mockResolvedValue(true);
    mocks.getLinkedAccounts.mockResolvedValue([]);
});

test('passes anonymous app content through without an authenticated lookup', async () => {
    mocks.auth.mockResolvedValue(null);
    expect(await AccountLinkingGuard(props)).toBe(children);
    expect(mocks.getLinkedAccounts).not.toHaveBeenCalled();
});

test('passes the original children through when no linking is needed', async () => {
    expect(await AccountLinkingGuard(props)).toBe(children);
    expect(mocks.cookieGet).not.toHaveBeenCalled();
});

test('propagates lookup errors to the app error boundary by default', async () => {
    const error = { statusCode: 500, errorCode: 'UNEXPECTED_ERROR', message: 'Lookup failed' };
    mocks.getLinkedAccounts.mockResolvedValue(error);
    await expect(AccountLinkingGuard(props)).rejects.toEqual(new ServiceErrorException(error));
});

test('shows the prompt again when a new optional provider is added, even of the same type', async () => {
    mocks.cookieGet.mockReturnValue({ value: JSON.stringify(['github-personal']) });
    mocks.getLinkedAccounts.mockResolvedValue([optionalAccount]);
    expect(await AccountLinkingGuard(props)).toBe(children);

    mocks.getLinkedAccounts.mockResolvedValue([
        optionalAccount,
        { ...optionalAccount, providerId: 'github-work' },
    ]);
    expect(await AccountLinkingGuard(props)).not.toBe(children);

    mocks.cookieGet.mockReturnValue({ value: JSON.stringify(['github-personal', 'github-work']) });
    expect(await AccountLinkingGuard(props)).toBe(children);
});

test('renaming a skipped optional provider does not show it again', async () => {
    mocks.cookieGet.mockReturnValue({ value: JSON.stringify(['github-personal']) });
    mocks.getLinkedAccounts.mockResolvedValue([{ ...optionalAccount, displayName: 'New name' }]);
    expect(await AccountLinkingGuard(props)).toBe(children);
});

test('a skipped optional provider becoming required shows the prompt again', async () => {
    mocks.cookieGet.mockReturnValue({ value: JSON.stringify(['github-personal']) });
    mocks.getLinkedAccounts.mockResolvedValue([{ ...optionalAccount, required: true }]);
    expect(await AccountLinkingGuard(props)).not.toBe(children);
});

test.each(['true', 'false', '{broken', '{}', '["github-personal", 1]'])('treats legacy or invalid cookie %s as no providers skipped', async (value) => {
    mocks.cookieGet.mockReturnValue({ value });
    mocks.getLinkedAccounts.mockResolvedValue([optionalAccount]);
    expect(await AccountLinkingGuard(props)).not.toBe(children);
});

test('new SSO providers and already-linked optional providers do not trigger the prompt', async () => {
    mocks.cookieGet.mockReturnValue({ value: JSON.stringify(['github-personal']) });
    mocks.getLinkedAccounts.mockResolvedValue([
        optionalAccount,
        { ...optionalAccount, providerId: 'github-sso', isAccountLinkingProvider: false },
        { ...optionalAccount, providerId: 'github-linked', isLinked: true },
    ]);
    expect(await AccountLinkingGuard(props)).toBe(children);
});
