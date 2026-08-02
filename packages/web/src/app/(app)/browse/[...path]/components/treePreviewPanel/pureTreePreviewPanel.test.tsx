import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SidebarProvider } from '@/components/ui/sidebar';

// Stub the file-tree item component so the test only exercises the
// empty-state branch. The real component pulls in `usePathname` and
// a router context that's heavy to mock for an empty-state assertion.
vi.mock('@/app/(app)/browse/components/fileTreeItemComponent', () => ({
    FileTreeItemComponent: () => <li data-testid="file-tree-item" />,
}));

vi.mock('next/navigation', () => ({
    usePathname: () => '/browse/github.com/foo/bar@main/-/tree/src',
}));

vi.mock('@/hooks/use-mobile', () => ({
    useIsMobile: () => false,
}));

const { PureTreePreviewPanel } = await import('./pureTreePreviewPanel');

const wrap = (ui: React.ReactNode) => (
    <SidebarProvider defaultOpen={true}>
        <ul>{ui}</ul>
    </SidebarProvider>
);

describe('PureTreePreviewPanel empty state (issue #1530)', () => {
    test('renders the "This directory is empty" message when the items array is empty', () => {
        // The empty-state message is rendered inside the same
        // ScrollArea as the items, so a real "directory" sub-path
        // (path != '') still shows the path header above the panel
        // and the "This directory is empty." copy below. The
        // PureTree component doesn't know about the path; the caller
        // decides whether to render the full panel (path != '') or
        // the full-panel "This repository is empty" copy (path == '').
        render(wrap(<PureTreePreviewPanel items={[]} />));
        expect(screen.getByText('This directory is empty.')).toBeTruthy();
    });
});
