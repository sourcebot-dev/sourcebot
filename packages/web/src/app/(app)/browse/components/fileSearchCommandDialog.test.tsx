import { afterEach, describe, expect, test, vi } from 'vitest';
import { render } from '@testing-library/react';

// Stub `useLocalStorage` so the test can capture the key the component
// passes and assert on it. Without this, we'd be asserting on real
// localStorage (which jsdom does provide, but the key changes per
// revision and the test only wants to verify the key format).
const capturedKeys: string[] = [];
vi.mock('usehooks-ts', () => ({
    useLocalStorage: <T,>(key: string, initial: T) => {
        capturedKeys.push(key);
        return [initial, vi.fn()] as [T, (v: T) => void];
    },
}));

// Make the params mock swappable per-test. We use a single mutable
// holder so each `it` can set its own (repoName, revisionName) tuple
// before rendering.
const mockParams: { repoName: string; revisionName: string | undefined } = {
    repoName: 'github.com/foo/bar',
    revisionName: 'main',
};
vi.mock('@/app/(app)/browse/hooks/useBrowseParams', () => ({
    useBrowseParams: () => ({ repoName: mockParams.repoName, revisionName: mockParams.revisionName }),
}));
vi.mock('@/app/(app)/browse/hooks/useBrowseState', () => ({
    useBrowseState: () => ({ state: { isFileSearchOpen: false }, updateBrowseState: vi.fn() }),
}));
vi.mock('@/app/(app)/browse/hooks/useBrowseNavigation', () => ({
    useBrowseNavigation: () => ({ navigateToPath: vi.fn() }),
}));

vi.mock('next/navigation', () => ({
    usePathname: () => '/browse/github.com/foo/bar@main/-/tree/src',
}));

vi.mock('@tanstack/react-query', () => ({
    useQuery: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock('@/app/api/(client)/client', () => ({
    getFiles: vi.fn(),
}));

vi.mock('react-hotkeys-hook', () => ({
    useHotkeys: vi.fn(),
}));

vi.mock('@/app/(app)/browse/components/fileTreeItemIcon', () => ({
    FileTreeItemIcon: () => null,
}));

vi.mock('@/components/ui/command', () => ({
    Command: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    CommandEmpty: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    CommandGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    CommandInput: () => null,
    CommandItem: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    CommandList: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    DialogContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    DialogDescription: () => null,
    DialogTitle: () => null,
}));

const { FileSearchCommandDialog } = await import('./fileSearchCommandDialog');

const renderWithParams = () => {
    capturedKeys.length = 0;
    render(<FileSearchCommandDialog />);
    return capturedKeys[0];
};

describe('FileSearchCommandDialog recents key (issue #1387)', () => {
    afterEach(() => {
        // Reset the mock params to the default between tests so a
        // mutation in one test doesn't leak into the next.
        mockParams.repoName = 'github.com/foo/bar';
        mockParams.revisionName = 'main';
    });

    test('scopes the recents localStorage key to the (repo, revision) tuple', () => {
        // The previous key was `recentlyOpenedFiles-${repoName}` — same
        // across revisions. After the fix, the key is scoped per
        // revision so switching branches doesn't carry over suggestions
        // from another revision that may not exist on the current one.
        mockParams.repoName = 'github.com/foo/bar';
        mockParams.revisionName = 'main';
        const key = renderWithParams();
        expect(key).toBe('recentlyOpenedFiles-github.com/foo/bar-main');
    });

    test('uses the HEAD fallback for the "no revision in URL" case', () => {
        // The file-fetch on the next line uses `revisionName ?? 'HEAD'`
        // as the default; the recents key needs to agree so the user
        // sees a consistent recents list for the "default branch" view.
        mockParams.repoName = 'github.com/foo/bar';
        mockParams.revisionName = undefined;
        const key = renderWithParams();
        expect(key).toBe('recentlyOpenedFiles-github.com/foo/bar-HEAD');
    });

    test('produces a different key for a different revision in the same repo', () => {
        // The bug was: switching from `main` to `feature/foo` showed
        // recents from `main`. After the fix, the keys differ, so the
        // recents are naturally scoped. This test asserts that the
        // keys differ for the two revisions.
        mockParams.repoName = 'github.com/foo/bar';
        mockParams.revisionName = 'main';
        const keyMain = renderWithParams();

        mockParams.revisionName = 'feature/foo';
        const keyFeature = renderWithParams();

        expect(keyMain).toBe('recentlyOpenedFiles-github.com/foo/bar-main');
        expect(keyFeature).toBe('recentlyOpenedFiles-github.com/foo/bar-feature/foo');
        expect(keyMain).not.toBe(keyFeature);
    });
});
