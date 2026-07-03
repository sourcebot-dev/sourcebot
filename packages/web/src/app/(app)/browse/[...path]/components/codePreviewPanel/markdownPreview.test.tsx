import { cleanup, render, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getRepoInfoByName: vi.fn(),
    getFileSource: vi.fn(),
    getFileBlame: vi.fn(),
}));

vi.mock('@/actions', () => ({
    getRepoInfoByName: mocks.getRepoInfoByName,
}));

vi.mock('@/features/git', () => ({
    getFileSource: mocks.getFileSource,
    getFileBlame: mocks.getFileBlame,
}));

vi.mock('@/app/(app)/components/pathHeader', () => ({
    PathHeader: ({ path }: { path: string }) => <div>Path: {path}</div>,
}));

vi.mock('./blameViewToggle', () => ({
    BlameViewToggle: ({ codeLabel }: { codeLabel?: string }) => (
        <div data-testid="blame-view-toggle">{codeLabel}</div>
    ),
}));

vi.mock('./pureCodePreviewPanel', () => ({
    PureCodePreviewPanel: ({ source, blame }: { source: string; blame?: unknown }) => (
        <pre data-testid="raw-source" data-has-blame={blame ? 'true' : 'false'}>{source}</pre>
    ),
}));

import { CodePreviewPanel } from './codePreviewPanel';
import { MarkdownPreviewPanel } from './markdownPreviewPanel';

afterEach(() => {
    cleanup();
});

const renderWithTooltipProvider = (ui: React.ReactNode) => render(
    <TooltipProvider>{ui}</TooltipProvider>
);

describe('CodePreviewPanel markdown preview', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mocks.getRepoInfoByName.mockResolvedValue({
            name: 'github.com/sourcebot-dev/sourcebot',
            displayName: 'sourcebot-dev/sourcebot',
            codeHostType: 'github',
            externalWebUrl: 'https://github.com/sourcebot-dev/sourcebot',
        });
        mocks.getFileBlame.mockResolvedValue({
            ranges: [],
            commits: {},
        });
    });

    test('renders markdown files as markdown by default', async () => {
        mocks.getFileSource.mockResolvedValue({
            source: '# Project README\n\n- fast search\n- code intelligence',
            language: 'Markdown',
            path: 'README.md',
            repo: 'github.com/sourcebot-dev/sourcebot',
            repoCodeHostType: 'github',
            repoDisplayName: 'sourcebot-dev/sourcebot',
            repoExternalWebUrl: 'https://github.com/sourcebot-dev/sourcebot',
            webUrl: 'https://sourcebot.example.com/browse/github.com/sourcebot-dev/sourcebot/-/blob/README.md',
        });

        render(await CodePreviewPanel({
            path: 'README.md',
            repoName: 'github.com/sourcebot-dev/sourcebot',
            revisionName: 'main',
        }));

        expect(screen.queryByRole('heading', { name: 'Project README' })).toBeTruthy();
        expect(screen.queryByText('fast search')).toBeTruthy();
        expect(screen.queryByTestId('raw-source')).toBeNull();
        expect(screen.getByTestId('blame-view-toggle').textContent).toBe('Preview');
    });

    test('keeps raw source view available for markdown files', async () => {
        mocks.getFileSource.mockResolvedValue({
            source: '# Project README\n\n- fast search\n- code intelligence',
            language: 'Markdown',
            path: 'README.md',
            repo: 'github.com/sourcebot-dev/sourcebot',
            repoCodeHostType: 'github',
            repoDisplayName: 'sourcebot-dev/sourcebot',
            repoExternalWebUrl: 'https://github.com/sourcebot-dev/sourcebot',
            webUrl: 'https://sourcebot.example.com/browse/github.com/sourcebot-dev/sourcebot/-/blob/README.md',
        });

        render(await CodePreviewPanel({
            path: 'README.md',
            repoName: 'github.com/sourcebot-dev/sourcebot',
            revisionName: 'main',
            viewMode: 'source',
        }));

        expect(screen.queryByRole('heading', { name: 'Project README' })).toBeNull();
        expect(screen.queryByTestId('raw-source')?.textContent).toContain('# Project README');
        expect(screen.getByTestId('blame-view-toggle').textContent).toBe('Source');
    });

    test('keeps markdown in raw source view when blame is enabled', async () => {
        mocks.getFileSource.mockResolvedValue({
            source: '# Project README\n\n- fast search',
            language: 'Markdown',
            path: 'README.md',
            repo: 'github.com/sourcebot-dev/sourcebot',
            repoCodeHostType: 'github',
            repoDisplayName: 'sourcebot-dev/sourcebot',
            repoExternalWebUrl: 'https://github.com/sourcebot-dev/sourcebot',
            webUrl: 'https://sourcebot.example.com/browse/github.com/sourcebot-dev/sourcebot/-/blob/README.md',
        });

        render(await CodePreviewPanel({
            path: 'README.md',
            repoName: 'github.com/sourcebot-dev/sourcebot',
            revisionName: 'main',
            blame: true,
        }));

        expect(screen.queryByRole('heading', { name: 'Project README' })).toBeNull();
        expect(screen.queryByTestId('raw-source')?.textContent).toContain('# Project README');
        expect(mocks.getFileBlame).toHaveBeenCalledWith({
            path: 'README.md',
            repo: 'github.com/sourcebot-dev/sourcebot',
            ref: 'main',
        }, { source: 'sourcebot-web-client' });
    });

    test('keeps markdown in raw source view when previewing another revision', async () => {
        mocks.getFileSource.mockResolvedValue({
            source: '# Previous README',
            language: 'Markdown',
            path: 'README.md',
            repo: 'github.com/sourcebot-dev/sourcebot',
            repoCodeHostType: 'github',
            repoDisplayName: 'sourcebot-dev/sourcebot',
            repoExternalWebUrl: 'https://github.com/sourcebot-dev/sourcebot',
            webUrl: 'https://sourcebot.example.com/browse/github.com/sourcebot-dev/sourcebot/-/blob/README.md',
        });

        renderWithTooltipProvider(await CodePreviewPanel({
            path: 'README.md',
            repoName: 'github.com/sourcebot-dev/sourcebot',
            revisionName: 'main',
            previewRef: 'abc123456789',
        }));

        expect(screen.queryByRole('heading', { name: 'Previous README' })).toBeNull();
        expect(screen.queryByTestId('raw-source')?.textContent).toContain('# Previous README');
        expect(mocks.getFileSource).toHaveBeenCalledWith({
            path: 'README.md',
            repo: 'github.com/sourcebot-dev/sourcebot',
            ref: 'abc123456789',
        }, { source: 'sourcebot-web-client' });
    });

    test('preserves source view when closing a revision preview', async () => {
        mocks.getFileSource.mockResolvedValue({
            source: '# Previous README',
            language: 'Markdown',
            path: 'README.md',
            repo: 'github.com/sourcebot-dev/sourcebot',
            repoCodeHostType: 'github',
            repoDisplayName: 'sourcebot-dev/sourcebot',
            repoExternalWebUrl: 'https://github.com/sourcebot-dev/sourcebot',
            webUrl: 'https://sourcebot.example.com/browse/github.com/sourcebot-dev/sourcebot/-/blob/README.md',
        });

        renderWithTooltipProvider(await CodePreviewPanel({
            path: 'README.md',
            repoName: 'github.com/sourcebot-dev/sourcebot',
            revisionName: 'main',
            previewRef: 'abc123456789',
            viewMode: 'source',
        }));

        expect(screen.getByLabelText('Close preview').getAttribute('href')).toBe(
            '/browse/github.com/sourcebot-dev/sourcebot@main/-/blob/README.md?view=source'
        );
    });

    test('does not mount raw html from repository markdown', () => {
        const { container } = render(
            <MarkdownPreviewPanel
                source={'# Safe\n\n<script>alert("xss")</script>\n\n<img src=x onerror=alert(1) />'}
                repoName="github.com/sourcebot-dev/sourcebot"
                revisionName="main"
                path="README.md"
            />
        );

        expect(container.querySelector('script')).toBeNull();
        expect(container.querySelector('img')).toBeNull();
        expect(screen.queryByText(/<script>alert/)).toBeTruthy();
    });

    test('rewrites relative markdown links to browse paths', () => {
        render(
            <MarkdownPreviewPanel
                source="[Guide](../docs/guide.md#install)"
                repoName="github.com/sourcebot-dev/sourcebot"
                revisionName="main"
                path="packages/web/README.md"
            />
        );

        expect(screen.getByRole('link', { name: 'Guide' }).getAttribute('href')).toBe(
            '/browse/github.com/sourcebot-dev/sourcebot@main/-/blob/packages%2Fdocs%2Fguide.md#install'
        );
    });

    test('adds heading ids for same-file markdown hash links', () => {
        render(
            <MarkdownPreviewPanel
                source={"# Install Guide\n\n[Jump](#install-guide)"}
                repoName="github.com/sourcebot-dev/sourcebot"
                revisionName="main"
                path="README.md"
            />
        );

        expect(screen.getByRole('heading', { name: 'Install Guide' }).getAttribute('id')).toBe('install-guide');
        expect(screen.getByRole('link', { name: 'Jump' }).getAttribute('href')).toBe('#install-guide');
    });

    test('deduplicates repeated heading ids', () => {
        render(
            <MarkdownPreviewPanel
                source={"## Usage\n\n## Usage"}
                repoName="github.com/sourcebot-dev/sourcebot"
                revisionName="main"
                path="README.md"
            />
        );

        const headings = screen.getAllByRole('heading', { name: 'Usage' });

        expect(headings[0].getAttribute('id')).toBe('usage');
        expect(headings[1].getAttribute('id')).toBe('usage-1');
    });

    test('decodes encoded relative markdown link paths before rewriting them', () => {
        render(
            <MarkdownPreviewPanel
                source="[Guide](./file%20with%20spaces%23and%3Fchars.md?plain=true#install)"
                repoName="github.com/sourcebot-dev/sourcebot"
                revisionName="main"
                path="docs/README.md"
            />
        );

        expect(screen.getByRole('link', { name: 'Guide' }).getAttribute('href')).toBe(
            '/browse/github.com/sourcebot-dev/sourcebot@main/-/blob/docs%2Ffile%20with%20spaces%23and%3Fchars.md?plain=true#install'
        );
    });

    test('preserves cross-file markdown hash links while headings expose targets', () => {
        render(
            <MarkdownPreviewPanel
                source={"# Current File\n\n[Guide](./guide.md#install)"}
                repoName="github.com/sourcebot-dev/sourcebot"
                revisionName="main"
                path="docs/README.md"
            />
        );

        expect(screen.getByRole('heading', { name: 'Current File' }).getAttribute('id')).toBe('current-file');
        expect(screen.getByRole('link', { name: 'Guide' }).getAttribute('href')).toBe(
            '/browse/github.com/sourcebot-dev/sourcebot@main/-/blob/docs%2Fguide.md#install'
        );
    });

    test('rewrites directory-style markdown links to browse tree paths', () => {
        render(
            <MarkdownPreviewPanel
                source="[Docs](./docs/)"
                repoName="github.com/sourcebot-dev/sourcebot"
                revisionName="main"
                path="README.md"
            />
        );

        expect(screen.getByRole('link', { name: 'Docs' }).getAttribute('href')).toBe(
            '/browse/github.com/sourcebot-dev/sourcebot@main/-/tree/docs'
        );
    });

    test('renders markdown images as non-fetching links', () => {
        render(
            <MarkdownPreviewPanel
                source="![Architecture](./assets/architecture.png)"
                repoName="github.com/sourcebot-dev/sourcebot"
                revisionName="main"
                path="docs/README.md"
            />
        );

        expect(screen.queryByRole('img')).toBeNull();
        expect(screen.getByRole('link', { name: 'Image: Architecture' }).getAttribute('href')).toBe(
            '/browse/github.com/sourcebot-dev/sourcebot@main/-/blob/docs%2Fassets%2Farchitecture.png'
        );
    });

    test('does not create nested anchors for linked markdown images', () => {
        const { container } = render(
            <MarkdownPreviewPanel
                source="[![Build status](./badge.svg)](https://example.com/status)"
                repoName="github.com/sourcebot-dev/sourcebot"
                revisionName="main"
                path="README.md"
            />
        );

        const links = container.querySelectorAll('a');

        expect(screen.queryByRole('img')).toBeNull();
        expect(links).toHaveLength(1);
        expect(links[0].getAttribute('href')).toBe('https://example.com/status');
        expect(links[0].textContent).toBe('Image: Build status');
    });

    test('decodes encoded relative markdown image paths before rewriting them', () => {
        render(
            <MarkdownPreviewPanel
                source="![Architecture](./image%20one.png)"
                repoName="github.com/sourcebot-dev/sourcebot"
                revisionName="main"
                path="docs/README.md"
            />
        );

        expect(screen.queryByRole('img')).toBeNull();
        expect(screen.getByRole('link', { name: 'Image: Architecture' }).getAttribute('href')).toBe(
            '/browse/github.com/sourcebot-dev/sourcebot@main/-/blob/docs%2Fimage%20one.png'
        );
    });

    test('renders external markdown images as non-fetching links', () => {
        render(
            <MarkdownPreviewPanel
                source="![Tracking pixel](https://example.com/pixel.png)"
                repoName="github.com/sourcebot-dev/sourcebot"
                revisionName="main"
                path="docs/README.md"
            />
        );

        expect(screen.queryByRole('img')).toBeNull();
        expect(screen.getByRole('link', { name: 'Image: Tracking pixel' }).getAttribute('href')).toBe(
            'https://example.com/pixel.png'
        );
    });

    test('renders reference-style markdown images as non-fetching links', () => {
        render(
            <MarkdownPreviewPanel
                source={"![Badge][badge]\n\n[badge]: https://example.com/badge.svg"}
                repoName="github.com/sourcebot-dev/sourcebot"
                revisionName="main"
                path="README.md"
            />
        );

        expect(screen.queryByRole('img')).toBeNull();
        expect(screen.getByRole('link', { name: 'Image: Badge' }).getAttribute('href')).toBe(
            'https://example.com/badge.svg'
        );
    });

    test('does not create nested anchors for linked reference-style markdown images', () => {
        const { container } = render(
            <MarkdownPreviewPanel
                source={"[![Build status][badge]](https://example.com/status)\n\n[badge]: https://example.com/badge.svg"}
                repoName="github.com/sourcebot-dev/sourcebot"
                revisionName="main"
                path="README.md"
            />
        );

        const links = container.querySelectorAll('a');

        expect(screen.queryByRole('img')).toBeNull();
        expect(links).toHaveLength(1);
        expect(links[0].getAttribute('href')).toBe('https://example.com/status');
        expect(links[0].textContent).toBe('Image: Build status');
    });
});
