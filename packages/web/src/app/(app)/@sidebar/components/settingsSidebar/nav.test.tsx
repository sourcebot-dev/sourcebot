import { describe, expect, test, vi } from 'vitest';
import { render } from '@testing-library/react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { ReactNode } from 'react';
import { Entitlement } from '@sourcebot/shared';

vi.mock('next/link', async () => {
    const { createElement } = await import('react');
    return {
        default: ({ href, children }: { href: string; children: ReactNode }) =>
            createElement('a', { href }, children),
    };
});

const mockEntitlements = vi.hoisted(() => ({
    current: [] as Entitlement[],
}));

vi.mock('@/features/entitlements/useEntitlements', () => ({
    useEntitlements: () => mockEntitlements.current,
}));

vi.mock('next/navigation', () => ({
    usePathname: () => '/settings/security',
}));

vi.mock('@/app/(app)/@sidebar/components/upgradeBadge', () => ({
    UpgradeBadge: () => <span data-testid="upgrade-badge">Upgrade</span>,
}));

vi.mock('@/hooks/use-mobile', () => ({
    useIsMobile: () => false,
}));

const { Nav } = await import('./nav');

// Two nav items: one gated on an entitlement the test is missing
// ('audit'), one ungated (no `requiredEntitlement`). The settings nav
// real entries (`Security` → `audit`, `License` → none) match this
// shape — see packages/web/src/app/(app)/settings/layout.tsx.
const GROUPS = [
    {
        label: 'Test group',
        items: [
            { href: '/settings/audit', title: 'Audit', icon: 'scroll-text' as const, requiredEntitlement: 'audit' as Entitlement },
            { href: '/settings/license', title: 'License', icon: 'key-round' as const },
        ],
    },
];

const renderNav = (isOwner?: boolean) => {
    mockEntitlements.current = [];
    return render(
        <SidebarProvider defaultOpen={true}>
            <TooltipProvider>
                <Nav groups={GROUPS} isOwner={isOwner} />
            </TooltipProvider>
        </SidebarProvider>
    );
};

const countBadges = (container: HTMLElement) =>
    container.querySelectorAll('[data-testid="upgrade-badge"]').length;

describe('settingsSidebar Nav upgrade badge gating (issue #1524)', () => {
    test('renders the upgrade badge for an OWNER missing the required entitlement', () => {
        // The ungated "License" item should never show a badge; the
        // gated "Audit" item should show exactly one when isOwner=true
        // and the user is missing the audit entitlement.
        const { container } = renderNav(true);
        expect(countBadges(container)).toBe(1);
    });

    test('does NOT render the upgrade badge for a non-owner (MEMBER) user', () => {
        // Same fixture, isOwner=false: the only entitlement-gated item
        // is suppressed, so the total drops to 0. The "License" item
        // was never gated and remains badge-free, so the count is a
        // clean 0 — the regression assertion for the bug.
        const { container } = renderNav(false);
        expect(countBadges(container)).toBe(0);
    });
});
