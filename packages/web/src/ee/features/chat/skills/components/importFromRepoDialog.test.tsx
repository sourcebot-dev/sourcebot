import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { RepositoryQuery } from '@/lib/types';
import type { FileTreeItem } from '@/features/git';

// cmdk (the Command palette) relies on browser APIs jsdom does not implement.
class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView = vi.fn();

vi.mock('@/app/api/(client)/client', () => ({
    listRepos: vi.fn(),
    getFiles: vi.fn(),
    getFileSource: vi.fn(),
}));

const clientApi = await import('@/app/api/(client)/client');
const { ImportFromRepoDialog } = await import('./importFromRepoDialog');

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

const repo: RepositoryQuery = {
    codeHostType: 'github',
    repoId: 1,
    repoName: 'github.com/acme/widgets',
    repoDisplayName: 'acme/widgets',
    webUrl: 'https://github.com/acme/widgets',
    defaultBranch: 'main',
    isFork: false,
    isArchived: false,
};

const files: FileTreeItem[] = [
    { type: 'blob', path: 'README.md', name: 'README.md' },
    { type: 'blob', path: 'docs/skill.md', name: 'skill.md' },
    { type: 'blob', path: 'src/index.ts', name: 'index.ts' },
];

function renderDialog(overrides: Partial<Parameters<typeof ImportFromRepoDialog>[0]> = {}) {
    const onImport = vi.fn();
    const onError = vi.fn();
    const onOpenChange = vi.fn();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
        <QueryClientProvider client={queryClient}>
            <ImportFromRepoDialog
                open
                onOpenChange={onOpenChange}
                onImport={onImport}
                onError={onError}
                {...overrides}
            />
        </QueryClientProvider>,
    );

    return { onImport, onError, onOpenChange };
}

describe('ImportFromRepoDialog', () => {
    test('lists repos, shows only markdown files, and imports the selected file', async () => {
        vi.mocked(clientApi.listRepos).mockResolvedValue([repo]);
        vi.mocked(clientApi.getFiles).mockResolvedValue(files);
        vi.mocked(clientApi.getFileSource).mockResolvedValue({
            source: '---\nname: Deploy Widgets\ndescription: Steps to deploy\n---\n\nRun the deploy script.',
            language: 'Markdown',
            path: 'docs/skill.md',
            repo: repo.repoName,
            repoCodeHostType: 'github',
            webUrl: 'https://github.com/acme/widgets/blob/main/docs/skill.md',
            blobSha: 'blob-sha-123',
        });

        const { onImport } = renderDialog();

        // Repository step.
        fireEvent.click(await screen.findByText('acme/widgets'));

        // File step: markdown only, the .ts file is filtered out.
        expect(await screen.findByText('skill.md')).toBeTruthy();
        expect(screen.getByText('docs/skill.md')).toBeTruthy();
        expect(screen.getAllByText('README.md').length).toBeGreaterThan(0);
        expect(screen.queryByText('index.ts')).toBeNull();
        expect(screen.queryByText('src/index.ts')).toBeNull();

        // getFiles is scoped to the repo's default branch.
        expect(clientApi.getFiles).toHaveBeenCalledWith({ repoName: repo.repoName, revisionName: 'main' });

        fireEvent.click(screen.getByText('skill.md'));

        await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
        expect(clientApi.getFileSource).toHaveBeenCalledWith({
            path: 'docs/skill.md',
            repo: repo.repoName,
            ref: 'main',
        });
        // Imports carry the parsed skill plus the source provenance (incl. blob OID)
        // so the parent can create a read-only, synced skill.
        expect(onImport).toHaveBeenCalledWith(
            expect.objectContaining({
                parsed: expect.objectContaining({
                    name: 'Deploy Widgets',
                    slug: 'deploy-widgets',
                    description: 'Steps to deploy',
                    instructions: 'Run the deploy script.',
                }),
                source: {
                    repoName: repo.repoName,
                    filePath: 'docs/skill.md',
                    revision: 'main',
                    blobSha: 'blob-sha-123',
                },
            }),
        );
    });

    test('does not import when the file has no resolvable blob version', async () => {
        vi.mocked(clientApi.listRepos).mockResolvedValue([repo]);
        vi.mocked(clientApi.getFiles).mockResolvedValue(files);
        // A response without a blobSha means we can't track the file for syncing.
        vi.mocked(clientApi.getFileSource).mockResolvedValue({
            source: '---\nname: Deploy Widgets\n---\n\nRun the deploy script.',
            language: 'Markdown',
            path: 'docs/skill.md',
            repo: repo.repoName,
            repoCodeHostType: 'github',
            webUrl: 'https://github.com/acme/widgets/blob/main/docs/skill.md',
        });

        const { onImport, onError } = renderDialog();

        fireEvent.click(await screen.findByText('acme/widgets'));
        fireEvent.click(await screen.findByText('skill.md'));

        await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
        expect(onImport).not.toHaveBeenCalled();
    });

    test('surfaces an error when the file cannot be fetched', async () => {
        vi.mocked(clientApi.listRepos).mockResolvedValue([repo]);
        vi.mocked(clientApi.getFiles).mockResolvedValue(files);
        vi.mocked(clientApi.getFileSource).mockResolvedValue({
            statusCode: 500,
            errorCode: 'UNEXPECTED_ERROR',
            message: 'boom',
        });

        const { onImport, onError } = renderDialog();

        fireEvent.click(await screen.findByText('acme/widgets'));
        fireEvent.click(await screen.findByText('skill.md'));

        await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
        expect(onImport).not.toHaveBeenCalled();
    });

    test('typing in the repo search does not crash and always sends a string query', async () => {
        vi.mocked(clientApi.listRepos).mockResolvedValue([repo]);

        renderDialog();

        await screen.findByText('acme/widgets');
        // Each keystroke re-keys the repo query; the CommandList must stay mounted
        // (cmdk throws "undefined is not iterable" if its list ref unmounts mid-search).
        const input = screen.getByPlaceholderText('Search your indexed repositories...');
        fireEvent.change(input, { target: { value: 'wid' } });
        fireEvent.change(input, { target: { value: 'widg' } });

        await waitFor(() => expect(screen.getByText('acme/widgets')).toBeTruthy());
        // The shared listRepos client calls value.toString() on every param, so an
        // undefined query would throw; the dialog must always pass a string.
        for (const call of vi.mocked(clientApi.listRepos).mock.calls) {
            expect(typeof call[0].query).toBe('string');
        }
    });

    test('releases the body pointer-events lock after import so the page stays interactive', async () => {
        vi.mocked(clientApi.listRepos).mockResolvedValue([repo]);
        vi.mocked(clientApi.getFiles).mockResolvedValue(files);
        vi.mocked(clientApi.getFileSource).mockResolvedValue({
            source: '---\nname: Deploy Widgets\n---\n\nRun the deploy script.',
            language: 'Markdown',
            path: 'docs/skill.md',
            repo: repo.repoName,
            repoCodeHostType: 'github',
            webUrl: 'https://github.com/acme/widgets/blob/main/docs/skill.md',
            blobSha: 'blob-sha-123',
        });

        // Mirror how the parent drives the dialog: a controlled `open` that flips
        // to false on import. Radix locks <body> while the modal is open.
        function Harness() {
            const [open, setOpen] = useState(true);
            return <ImportFromRepoDialog open={open} onOpenChange={setOpen} onImport={vi.fn()} onError={vi.fn()} />;
        }
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(<QueryClientProvider client={queryClient}><Harness /></QueryClientProvider>);

        fireEvent.click(await screen.findByText('acme/widgets'));
        fireEvent.click(await screen.findByText('skill.md'));

        // Once the dialog closes, the page must not be left frozen.
        await waitFor(() => expect(document.body.style.pointerEvents).not.toBe('none'));
    });
});
