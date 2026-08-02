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
    test('renders an honest empty-state message when the items array is empty', () => {
        // The empty-state message is rendered inside the same
        // ScrollArea as the items, so a real "directory" sub-path
        // (path != '') still shows the path header above the panel
        // and the empty-state copy below. The PureTree component
        // doesn't know about the path; the caller decides whether
        // to render the full panel (path != '') or the full-panel
        // "This repository is empty" copy (path == '').
        //
        // We can't tell from `[]` alone whether the directory is
        // empty or the path doesn't exist in this revision
        // (git ls-tree returns empty output for both cases), so the
        // message is intentionally ambiguous. Bugbot finding on PR
        // #1531.
        render(wrap(<PureTreePreviewPanel items={[]} />));
        expect(screen.getByText('This path has no contents in this revision.')).toBeTruthy();
    });
});
