import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileSearchCommandDialog } from './fileSearchCommandDialog';

const mocks = vi.hoisted(() => ({
    params: { repoName: 'github.com/org/repo', revisionName: 'main' as string | undefined },
    navigateToPath: vi.fn(),
    updateBrowseState: vi.fn(),
    files: [
        { type: 'blob', name: 'main.ts', path: 'src/main.ts' },
        { type: 'blob', name: 'feature.ts', path: 'src/feature.ts' },
    ],
}));

vi.mock('../hooks/useBrowseParams', () => ({ useBrowseParams: () => mocks.params }));
vi.mock('../hooks/useBrowseNavigation', () => ({
    useBrowseNavigation: () => ({ navigateToPath: mocks.navigateToPath }),
}));
vi.mock('../hooks/useBrowseState', () => ({
    useBrowseState: () => ({
        state: { isFileSearchOpen: true },
        updateBrowseState: mocks.updateBrowseState,
    }),
}));
vi.mock('react-hotkeys-hook', () => ({ useHotkeys: vi.fn() }));
vi.mock('@tanstack/react-query', () => ({
    useQuery: () => ({
        data: mocks.files,
        isLoading: false,
        isError: false,
    }),
}));
vi.mock('@/app/api/(client)/client', () => ({ getFiles: vi.fn() }));
vi.mock('@/app/(app)/browse/components/fileTreeItemIcon', () => ({ FileTreeItemIcon: () => null }));

beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mocks.params = { repoName: 'github.com/org/repo', revisionName: 'main' };
    mocks.files = [
        { type: 'blob', name: 'main.ts', path: 'src/main.ts' },
        { type: 'blob', name: 'feature.ts', path: 'src/feature.ts' },
    ];
    vi.stubGlobal('ResizeObserver', class {
        observe() {}
        unobserve() {}
        disconnect() {}
    });
    HTMLElement.prototype.scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollTo = vi.fn();
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

const selectFile = (name: string) => {
    fireEvent.change(screen.getByRole('combobox'), { target: { value: name } });
    fireEvent.click(screen.getByRole('option'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
};

describe('file search recents', () => {
    it('keeps separate histories when switching revisions and restores them after remounting', () => {
        const view = render(<FileSearchCommandDialog />);
        selectFile('main.ts');
        expect(mocks.navigateToPath).toHaveBeenLastCalledWith({
            repoName: mocks.params.repoName,
            revisionName: 'main',
            path: 'src/main.ts',
            pathType: 'blob',
        });

        mocks.params.revisionName = 'feature';
        view.rerender(<FileSearchCommandDialog />);
        expect(screen.queryByText('main.ts')).toBeNull();
        selectFile('feature.ts');

        mocks.params.revisionName = 'main';
        view.rerender(<FileSearchCommandDialog />);
        expect(screen.getByText('main.ts')).toBeTruthy();
        expect(screen.queryByText('feature.ts')).toBeNull();

        view.unmount();
        mocks.params.revisionName = 'feature';
        render(<FileSearchCommandDialog />);
        expect(screen.getByText('feature.ts')).toBeTruthy();
        expect(screen.queryByText('main.ts')).toBeNull();
    });

    it('shares history between the default revision and explicit HEAD', () => {
        mocks.params.revisionName = undefined;
        const view = render(<FileSearchCommandDialog />);
        selectFile('main.ts');

        mocks.params.revisionName = 'HEAD';
        view.rerender(<FileSearchCommandDialog />);
        expect(screen.getByText('main.ts')).toBeTruthy();
    });

    it('does not inherit legacy history whose revision is unknown', () => {
        localStorage.setItem(`recentlyOpenedFiles-${mocks.params.repoName}`, JSON.stringify([
            { type: 'blob', name: 'old.ts', path: 'src/old.ts' },
        ]));

        render(<FileSearchCommandDialog />);

        expect(screen.queryByText('old.ts')).toBeNull();
    });

    it('keeps repository and revision pairs distinct even when names contain separators', () => {
        mocks.params = { repoName: 'repo@branch', revisionName: 'feature' };
        const view = render(<FileSearchCommandDialog />);
        selectFile('main.ts');

        mocks.params = { repoName: 'repo', revisionName: 'branch@feature' };
        view.rerender(<FileSearchCommandDialog />);
        expect(screen.queryByText('main.ts')).toBeNull();
    });

    it('hides files removed from the current revision when its file list changes', () => {
        const view = render(<FileSearchCommandDialog />);
        selectFile('main.ts');
        selectFile('feature.ts');

        mocks.files = mocks.files.filter(file => file.name !== 'main.ts');
        view.rerender(<FileSearchCommandDialog />);

        expect(screen.queryByText('main.ts')).toBeNull();
        fireEvent.click(screen.getByRole('option'));
        expect(mocks.navigateToPath).toHaveBeenLastCalledWith(expect.objectContaining({ path: 'src/feature.ts' }));
    });

    it('bounds history across revisions without creating a key for every commit', () => {
        const key = `recentlyOpenedFiles-v2-${JSON.stringify(mocks.params.repoName)}`;
        const history = Array.from({ length: 100 }, (_, index) => ({
            revision: `commit-${index}`,
            file: { type: 'blob', name: 'main.ts', path: 'src/main.ts' },
        }));
        localStorage.setItem(key, JSON.stringify(history));
        const view = render(<FileSearchCommandDialog />);
        selectFile('main.ts');

        mocks.params.revisionName = 'next-commit';
        view.rerender(<FileSearchCommandDialog />);
        selectFile('feature.ts');
        selectFile('feature.ts');

        const stored = JSON.parse(localStorage.getItem(key)!);
        expect(localStorage.length).toBe(1);
        expect(stored).toHaveLength(100);
        expect(stored[0]).toEqual({ revision: 'next-commit', file: mocks.files[1] });
        expect(stored[1]).toEqual({ revision: 'main', file: mocks.files[0] });
        expect(stored.at(-1).revision).toBe('commit-97');
    });
});
