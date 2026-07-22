import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { LinkedAccount } from '@/ee/features/sso/actions';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('next-auth/react', () => ({
    signIn: vi.fn(),
}));

vi.mock('@/components/hooks/use-toast', () => ({
    useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/ee/features/sso/actions', () => ({
    unlinkLinkedAccountProvider: vi.fn(),
}));

vi.mock('@/features/workerApi/actions', () => ({
    triggerAccountPermissionSync: vi.fn(),
}));

vi.mock('@/app/api/(client)/client', () => ({
    getAccountSyncStatus: vi.fn(),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/utils', () => ({
    cn: (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' '),
    getAuthProviderInfo: () => ({ displayName: 'Bitbucket Server', icon: null }),
    isServiceError: () => false,
    unwrapServiceError: (value: unknown) => value,
}));

vi.mock('./providerIcon', () => ({
    ProviderIcon: () => <div data-testid="provider-icon" />,
}));

const { LinkedAccountProviderCard } = await import('./linkedAccountProviderCard');

const linkedAccount: LinkedAccount = {
    providerId: 'bitbucket-server-corp',
    providerType: 'bitbucket-server',
    isLinked: true,
    accountId: 'account_1',
    providerAccountId: 'user_1',
    isAccountLinkingProvider: true,
    required: false,
    supportsPermissionSync: true,
};

const renderCard = (account: LinkedAccount) => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return render(
        <QueryClientProvider client={queryClient}>
            <LinkedAccountProviderCard linkedAccount={account} />
        </QueryClientProvider>,
    );
};

afterEach(() => {
    cleanup();
});

describe('LinkedAccountProviderCard permission sync health', () => {
    test('shows a healthy linked account as connected', () => {
        renderCard(linkedAccount);

        expect(screen.getByText('Connected')).toBeTruthy();
        expect(screen.queryByText('Needs attention')).toBeNull();
    });

    test('shows reconnect guidance instead of permission refresh when repository permissions were cleared', () => {
        renderCard({
            ...linkedAccount,
            permissionSyncIssue: 'REAUTHENTICATION_REQUIRED',
        });

        expect(screen.getByText('Needs attention')).toBeTruthy();
        expect(screen.getByText('Reconnect this account to restore repository access.')).toBeTruthy();
        expect(screen.queryByText('Connected')).toBeNull();
        expect(screen.getByText('Reconnect Account')).toBeTruthy();
        expect(screen.queryByText('Refresh Permissions')).toBeNull();
    });

    test('shows scope-specific guidance when the OAuth grant is insufficient', () => {
        renderCard({
            ...linkedAccount,
            permissionSyncIssue: 'INSUFFICIENT_SCOPE',
        });

        expect(screen.getByText('Additional permissions are required to restore repository access.')).toBeTruthy();
    });
});
