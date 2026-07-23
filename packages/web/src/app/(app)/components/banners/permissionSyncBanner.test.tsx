import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { PermissionSyncStatusResponse } from '@/app/api/(server)/ee/permissionSyncStatus/api';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('@/app/api/(client)/client', () => ({
    getPermissionSyncStatus: vi.fn(),
}));

vi.mock('@/lib/utils', () => ({
    cn: (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' '),
    getAuthProviderInfo: () => ({ displayName: 'Bitbucket Server' }),
    unwrapServiceError: (value: unknown) => value,
}));

vi.mock('./bannerShell', () => ({
    BannerShell: ({ title, description, action }: {
        title: ReactNode;
        description?: ReactNode;
        action?: ReactNode;
    }) => (
        <div>
            <div>{title}</div>
            <div>{description}</div>
            <div>{action}</div>
        </div>
    ),
}));

const { PermissionSyncBanner } = await import('./permissionSyncBanner');

const renderBanner = (initialStatus: PermissionSyncStatusResponse) => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return render(
        <QueryClientProvider client={queryClient}>
            <PermissionSyncBanner
                id="permissionSync"
                dismissible={false}
                role="MEMBER"
                now={new Date('2026-07-22T12:00:00Z')}
                initialStatus={initialStatus}
            />
        </QueryClientProvider>,
    );
};

afterEach(() => {
    cleanup();
});

describe('PermissionSyncBanner', () => {
    test('prompts the user to review linked accounts when reauthentication is required', () => {
        renderBanner({
            hasPendingFirstSync: false,
            issues: [{
                accountId: 'account_1',
                providerId: 'bitbucket-server-corp',
                providerType: 'bitbucket-server',
                reason: 'REAUTHENTICATION_REQUIRED',
                occurredAt: '2026-07-22T12:00:00.000Z',
                isSyncing: false,
            }],
        });

        expect(screen.getByText('Repository access from Bitbucket Server needs attention.')).toBeTruthy();
        expect(screen.getByText(/Review your linked accounts to restore access to private repositories/)).toBeTruthy();
        expect(screen.getByRole('link', { name: 'Review linked accounts' }).getAttribute('href'))
            .toBe('/settings/linked-accounts');
    });

    test('uses the same remediation when additional scope is required', () => {
        renderBanner({
            hasPendingFirstSync: false,
            issues: [{
                accountId: 'account_1',
                providerId: 'github',
                providerType: 'github',
                reason: 'INSUFFICIENT_SCOPE',
                occurredAt: null,
                isSyncing: false,
            }],
        });

        expect(screen.getByText(/Review your linked accounts to restore access to private repositories/)).toBeTruthy();
    });

    test('retains the existing initial-sync progress state', () => {
        renderBanner({ hasPendingFirstSync: true, issues: [] });

        expect(screen.getByText(/Syncing repository access with Sourcebot/)).toBeTruthy();
    });

    test('shows syncing while recovering an account with an unresolved issue', () => {
        renderBanner({
            hasPendingFirstSync: false,
            issues: [{
                accountId: 'account_1',
                providerId: 'bitbucket-server-corp',
                providerType: 'bitbucket-server',
                reason: 'REAUTHENTICATION_REQUIRED',
                occurredAt: '2026-07-22T12:00:00.000Z',
                isSyncing: true,
            }],
        });

        expect(screen.getByText(/Syncing repository access with Sourcebot/)).toBeTruthy();
        expect(screen.queryByText(/needs attention/)).toBeNull();
    });
});
