import { describe, expect, test, vi } from 'vitest';
import { render } from '@testing-library/react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { ReactNode } from 'react';
import { Entitlement } from '@sourcebot/shared';

// next/link renders a plain anchor so we can assert on the rendered href
// without a Next.js router context.
vi.mock('next/link', async () => {
    const { createElement } = await import('react');
    return {
        default: ({ href, children }: { href: string; children: ReactNode }) =>
            createElement('a', { href }, children),
    };
});

// `useEntitlements` is a client hook backed by an entitlements context.
// Stub it so each test can pick the entitlement set it wants.
const mockEntitlements = vi.hoisted(() => ({
    current: [] as Entitlement[],
}));

vi.mock('@/features/entitlements/useEntitlements', () => ({
    useEntitlements: () => mockEntitlements.current,
}));

vi.mock('next/navigation', () => ({
    usePathname: () => '/search',
}));

// Stub the UpgradeBadge so the test doesn't need the lucide-react tree.
vi.mock('@/app/(app)/@sidebar/components/upgradeBadge', () => ({
    UpgradeBadge: () => <span data-testid="upgrade-badge">Upgrade</span>,
}));

// useIsMobile reads window.matchMedia in a useEffect, which jsdom does
// not implement. Stub it so the test environment stays stable.
vi.mock('@/hooks/use-mobile', () => ({
    useIsMobile: () => false,
}));

// Import after mocks so the test file's hoisted values take effect.
const { Nav } = await import('./nav');

const renderNav = (opts: { isOwner?: boolean; isSignedIn?: boolean }) => {
    // No entitlements: every gated nav item in the default sidebar
    // ("settings" → audit) should be missing its required entitlement
    // and would therefore trigger the badge if the isOwner gate is not
    // in place.
    mockEntitlements.current = [];
    return render(
        // SidebarProvider is required because Nav uses SidebarMenuButton
        // which calls useSidebar(); the provider's "defaultOpen" is
        // arbitrary for these tests because we only assert on badge
        // presence, not on interaction state.
        <SidebarProvider defaultOpen={true}>
            <TooltipProvider>
                <Nav
                    isSettingsNotificationVisible={false}
                    isSignedIn={opts.isSignedIn ?? true}
                    homeView="search"
                    isOwner={opts.isOwner}
                />
            </TooltipProvider>
        </SidebarProvider>
    );
};

const countBadges = (container: HTMLElement) =>
    container.querySelectorAll('[data-testid="upgrade-badge"]').length;

describe('Nav upgrade badge gating (issue #1524)', () => {
    test('renders the upgrade badge for an OWNER who is missing the required entitlement', () => {
        // Without the fix, isOwner is ignored and the badge shows for
        // everyone. With the fix, the badge only renders for owners —
        // this asserts the positive case (the badge is reachable at all
        // when the user IS an owner).
        const { container } = renderNav({ isOwner: true });
        expect(countBadges(container)).toBeGreaterThan(0);
    });

    test('does NOT render the upgrade badge for a non-owner (MEMBER) user', () => {
        // The same fixture as the positive test, but with isOwner=false.
        // The badge must disappear — the entitlement check is unchanged,
        // so the only thing that suppresses the badge is the new isOwner
        // gate.
        const { container } = renderNav({ isOwner: false });
        expect(countBadges(container)).toBe(0);
    });

    test('does NOT render the upgrade badge for an unauthenticated user', () => {
        // Unauthenticated visitors hit the sidebar on the landing page
        // (no auth context, so isOwner defaults to false). No badge.
        const { container } = renderNav({ isOwner: undefined, isSignedIn: false });
        expect(countBadges(container)).toBe(0);
    });
});
