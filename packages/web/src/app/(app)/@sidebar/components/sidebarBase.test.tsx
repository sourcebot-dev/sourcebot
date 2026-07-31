import { describe, expect, test, vi } from 'vitest';
import { render } from '@testing-library/react';
import { SidebarProvider } from '@/components/ui/sidebar';
import type { ReactNode } from 'react';

// The SidebarBase component pulls in a lot of client-only dependencies
// (theme, keymap, PostHog, signOut, lucide icons). Stub the heavy
// imports so the test only exercises the upgrade CTA gate, which is
// the only behaviour this PR changes.
vi.mock('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
    DropdownMenuContent: ({ children }: { children: ReactNode }) => <>{children}</>,
    DropdownMenuGroup: ({ children }: { children: ReactNode }) => <>{children}</>,
    DropdownMenuItem: ({ children }: { children: ReactNode }) => <>{children}</>,
    DropdownMenuPortal: ({ children }: { children: ReactNode }) => <>{children}</>,
    DropdownMenuRadioGroup: ({ children }: { children: ReactNode }) => <>{children}</>,
    DropdownMenuRadioItem: () => null,
    DropdownMenuSeparator: () => null,
    DropdownMenuSub: ({ children }: { children: ReactNode }) => <>{children}</>,
    DropdownMenuSubContent: ({ children }: { children: ReactNode }) => <>{children}</>,
    DropdownMenuSubTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/app/components/sourcebotLogo', () => ({
    SourcebotLogo: () => <span data-testid="sourcebot-logo" />,
}));

vi.mock('@/components/userAvatar', () => ({
    UserAvatar: () => <span data-testid="user-avatar" />,
}));

vi.mock('@/hooks/use-mobile', () => ({
    useIsMobile: () => false,
}));

vi.mock('@/hooks/useKeymapType', () => ({
    useKeymapType: () => ['default', vi.fn()] as const,
}));

vi.mock('next-themes', () => ({
    useTheme: () => ({ theme: 'light', setTheme: vi.fn(), resolvedTheme: 'light' }),
}));

vi.mock('posthog-js', () => ({
    default: { capture: vi.fn() },
}));

vi.mock('next-auth/react', () => ({
    signOut: vi.fn(),
}));

vi.mock('./whatsNewSidebarButton', () => ({
    WhatsNewSidebarButton: () => null,
}));

vi.mock('./bookACallSidebarButton', () => ({
    BookACallSidebarButton: () => null,
}));

// The UpgradeButton component itself makes a fetch call to offers.
// Stub the inner button to just render a recognisable marker so the
// test can assert on its presence vs absence.
vi.mock('./upgradeButton', () => ({
    UpgradeButton: () => <button data-testid="upgrade-button">Upgrade to Pro</button>,
}));

vi.mock('lucide-react', () => ({
    ArrowLeftToLineIcon: () => null,
    ArrowRightToLineIcon: () => null,
    ChevronsUpDown: () => null,
    CodeIcon: () => null,
    Laptop: () => null,
    LogIn: () => null,
    LogOut: () => null,
    Menu: () => null,
    Moon: () => null,
    SettingsIcon: () => null,
    Sun: () => null,
    UserIcon: () => null,
}));

vi.mock('@/app/components/keyboardShortcutHint', () => ({
    KeyboardShortcutHint: () => null,
}));

const { SidebarBase } = await import('./sidebarBase');

const renderSidebarBase = (opts: { isOwner: boolean; isValidLicenseActive: boolean }) => {
    return render(
        <SidebarProvider defaultOpen={true}>
            <SidebarBase
                session={null}
                isValidLicenseActive={opts.isValidLicenseActive}
                isAskGhEnabled={false}
                isOwner={opts.isOwner}
                headerContent={<div data-testid="header">header</div>}
            >
                <div data-testid="child">child</div>
            </SidebarBase>
        </SidebarProvider>
    );
};

const hasUpgradeButton = (container: HTMLElement) =>
    container.querySelectorAll('[data-testid="upgrade-button"]').length > 0;

describe('SidebarBase UpgradeButton gating (issue #1524)', () => {
    test('renders the UpgradeButton for an OWNER when no license is active', () => {
        // Owner + invalid license → button shows. This is the existing
        // happy path the bug is preserving; the assertion makes sure
        // the gate didn't accidentally hide it for owners too.
        const { container } = renderSidebarBase({ isOwner: true, isValidLicenseActive: false });
        expect(hasUpgradeButton(container)).toBe(true);
    });

    test('does NOT render the UpgradeButton for a non-owner (MEMBER) even when no license is active', () => {
        // Member + invalid license → button hidden. This is the
        // regression test for the bug. The "no license" condition is
        // still true, so the only thing that suppresses the button is
        // the new isOwner gate.
        const { container } = renderSidebarBase({ isOwner: false, isValidLicenseActive: false });
        expect(hasUpgradeButton(container)).toBe(false);
    });

    test('does NOT render the UpgradeButton for an OWNER when a license is already active', () => {
        // Owner + valid license → button hidden. This is the existing
        // gate (was `!isValidLicenseActive`); adding it to the suite
        // makes sure the isOwner refactor didn't break it.
        const { container } = renderSidebarBase({ isOwner: true, isValidLicenseActive: true });
        expect(hasUpgradeButton(container)).toBe(false);
    });
});
