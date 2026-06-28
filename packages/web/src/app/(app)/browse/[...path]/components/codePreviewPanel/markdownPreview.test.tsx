import { cleanup, render, screen } from '@testing-library/react';
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
    BlameViewToggle: () => <div>Blame toggle</div>,
}));

vi.mock('./pureCodePreviewPanel', () => ({
    PureCodePreviewPanel: ({ source }: { source: string }) => <pre data-testid="raw-source">{source}</pre>,
}));

import { CodePreviewPanel } from './codePreviewPanel';

afterEach(() => {
    cleanup();
});

describe('CodePreviewPanel markdown preview', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mocks.getRepoInfoByName.mockResolvedValue({
            name: 'github.com/sourcebot-dev/sourcebot',
            displayName: 'sourcebot-dev/sourcebot',
            codeHostType: 'github',
            externalWebUrl: 'https://github.com/sourcebot-dev/sourcebot',
        });
        mocks.getFileBlame.mockResolvedValue(undefined);
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
    });
});
