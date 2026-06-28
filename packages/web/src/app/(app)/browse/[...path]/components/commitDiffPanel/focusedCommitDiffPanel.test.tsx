import { cleanup, render, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getRepoInfoByName: vi.fn(),
    getCommit: vi.fn(),
    getDiff: vi.fn(),
}));

vi.mock('@/actions', () => ({
    getRepoInfoByName: mocks.getRepoInfoByName,
}));

vi.mock('@/features/git', () => ({
    getCommit: mocks.getCommit,
    getDiff: mocks.getDiff,
}));

vi.mock('@/app/(app)/components/pathHeader', () => ({
    PathHeader: ({ path }: { path: string }) => <div>Path: {path}</div>,
}));

vi.mock('./lightweightDiffViewer', () => ({
    LightweightDiffViewer: () => <div data-testid="diff-viewer" />,
}));

import { FocusedCommitDiffPanel } from './focusedCommitDiffPanel';

afterEach(() => {
    cleanup();
});

const renderWithTooltipProvider = (ui: React.ReactNode) => render(
    <TooltipProvider>{ui}</TooltipProvider>
);

describe('FocusedCommitDiffPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mocks.getRepoInfoByName.mockResolvedValue({
            name: 'github.com/sourcebot-dev/sourcebot',
            displayName: 'sourcebot-dev/sourcebot',
            codeHostType: 'github',
            externalWebUrl: 'https://github.com/sourcebot-dev/sourcebot',
        });

        mocks.getCommit.mockResolvedValue({
            hash: 'abc123456789',
            date: '2026-01-02T03:04:05.000Z',
            message: 'Update README',
            refs: '',
            body: '',
            authorName: 'Sourcebot Maintainer',
            authorEmail: 'maintainer@sourcebot.dev',
            parents: ['parent123'],
        });

        mocks.getDiff.mockResolvedValue({
            files: [
                {
                    oldPath: 'README.md',
                    newPath: 'README.md',
                    hunks: [
                        {
                            oldRange: { start: 1, lines: 1 },
                            newRange: { start: 1, lines: 1 },
                            body: '-old\n+new',
                        },
                    ],
                },
            ],
        });
    });

    test('preserves source view when exiting a focused diff', async () => {
        renderWithTooltipProvider(await FocusedCommitDiffPanel({
            repoName: 'github.com/sourcebot-dev/sourcebot',
            revisionName: 'main',
            commitSha: 'abc123456789',
            path: 'README.md',
            viewMode: 'source',
        }));

        expect(screen.getByLabelText('Exit diff view').getAttribute('href')).toBe(
            '/browse/github.com/sourcebot-dev/sourcebot@main/-/blob/README.md?view=source'
        );
        expect(screen.getByTestId('diff-viewer')).toBeTruthy();
    });
});
