import { afterEach, describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Stub the folder-contents client and the path header so the test
// only exercises the empty-state branches in treePreviewPanelClient.
// The folder-contents client makes a real network call; the path
// header pulls in router context. Both are irrelevant for the
// empty-state assertions.
vi.mock('@/app/api/(client)/client', () => ({
    getFolderContents: vi.fn(),
}));

vi.mock('@/app/(app)/components/pathHeader', () => ({
    PathHeader: () => <div data-testid="path-header" />,
}));

vi.mock('@/components/ui/separator', () => ({
    Separator: () => <hr data-testid="separator" />,
}));

vi.mock('@/components/ui/skeleton', () => ({
    Skeleton: () => <div data-testid="skeleton" />,
}));

vi.mock('next/navigation', () => ({
    usePathname: () => '/browse/github.com/foo/bar@main/-/tree/src',
}));

vi.mock('@tanstack/react-query', () => ({
    useQuery: vi.fn(),
}));

vi.mock('react-hotkeys-hook', () => ({
    useHotkeys: vi.fn(),
}));

const mockQueryState = vi.hoisted(() => ({
    current: { data: undefined as unknown, isPending: false, isError: false },
}));

vi.mock('@tanstack/react-query', () => ({
    useQuery: () => mockQueryState.current,
}));

const { TreePreviewPanelClient } = await import('./treePreviewPanelClient');

const baseRepo = { name: 'github.com/foo/bar', codeHostType: 'github' as const };

const renderClient = (opts: { path: string; revisionName?: string }) => {
    return render(
        <TreePreviewPanelClient
            path={opts.path}
            repoName="github.com/foo/bar"
            revisionName={opts.revisionName ?? 'main'}
            repo={baseRepo}
        />
    );
};

describe('TreePreviewPanelClient empty-state branches (issue #1530)', () => {
    afterEach(() => {
        mockQueryState.current = { data: undefined, isPending: false, isError: false };
    });

    test('renders the "This repository is empty." message at the root when the response is []', () => {
        // The root-path case takes the full panel (no PathHeader, no
        // Separator). The "directory" copy from PureTreePreviewPanel
        // is NOT used here — the root case is more emphatic and
        // accurate.
        mockQueryState.current = { data: [], isPending: false, isError: false };
        renderClient({ path: '' });
        expect(screen.getByText('This repository is empty.')).toBeTruthy();
        expect(screen.queryByTestId('path-header')).toBeNull();
        expect(screen.queryByTestId('separator')).toBeNull();
    });

    test('renders the "Error loading tree preview" message on a non-404 service error', () => {
        // The folder-contents client returns the service error
        // object for any non-NOT_FOUND error. Bugbot finding on
        // PR #1531: the non-404 case keeps the existing copy.
        mockQueryState.current = {
            data: { statusCode: 500, errorCode: 'UNEXPECTED_ERROR', message: 'boom' },
            isPending: false,
            isError: false,
        };
        renderClient({ path: 'src' });
        expect(screen.getByText('Error loading tree preview')).toBeTruthy();
    });
});
