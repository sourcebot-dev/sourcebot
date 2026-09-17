import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { LinkedAccount } from '../types';

const mocks = vi.hoisted(() => ({ skip: vi.fn(), refresh: vi.fn() }));
vi.mock('@/ee/features/sso/actions', () => ({ skipOptionalProvidersLink: mocks.skip }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('./linkedAccountProviderCard', () => ({ LinkedAccountProviderCard: () => null }));
vi.mock('@/lib/utils', () => ({
    cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
    isServiceError: (value: unknown) => !!value && typeof value === 'object' && 'errorCode' in value,
}));
const { ConnectAccountsCard } = await import('./connectAccountsCard');
const optionalAccount: LinkedAccount = {
    providerId: 'github-personal', providerType: 'github', isLinked: false,
    isAccountLinkingProvider: true, required: false, supportsPermissionSync: true,
};

beforeEach(() => {
    vi.resetAllMocks();
    mocks.skip.mockResolvedValue(true);
});
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

test('skips only the unlinked optional account-linking providers offered by this screen', async () => {
    render(<ConnectAccountsCard linkedAccounts={[
        optionalAccount,
        { ...optionalAccount, providerId: 'github-work' },
        { ...optionalAccount, providerId: 'linked', isLinked: true },
        { ...optionalAccount, providerId: 'required', isLinked: true, required: true },
        { ...optionalAccount, providerId: 'sso', isAccountLinkingProvider: false },
    ]} callbackUrl="/oauth/authorize?state=original" />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(mocks.skip).toHaveBeenCalledWith(['github-personal', 'github-work']);
});

test('does not offer skipping while a required provider is unlinked', () => {
    render(<ConnectAccountsCard linkedAccounts={[optionalAccount, { ...optionalAccount, providerId: 'required', required: true }]} />);
    expect(screen.queryByRole('button', { name: 'Skip for now' })).toBeNull();
});

test('allows retrying when saving the skip preference fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.skip.mockResolvedValue({ statusCode: 500, errorCode: 'UNEXPECTED_ERROR', message: 'Failed to save' });
    render(<ConnectAccountsCard linkedAccounts={[optionalAccount]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    await waitFor(() => expect(console.error).toHaveBeenCalled());
    expect(mocks.refresh).not.toHaveBeenCalled();

    mocks.skip.mockResolvedValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
});
