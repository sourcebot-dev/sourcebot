import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import BrowsePage from './page';

vi.mock('@/auth', () => ({
    auth: vi.fn().mockResolvedValue(null),
}));

vi.mock('./components/trackRepoVisit', () => ({
    TrackRepoVisit: () => null,
}));

vi.mock('./components/codePreviewPanel/codePreviewPanel', () => ({
    CodePreviewPanel: ({ viewMode }: { viewMode: string }) => <div data-testid="code-preview">{viewMode}</div>,
}));

vi.mock('./components/commitDiffPanel/focusedCommitDiffPanel', () => ({
    FocusedCommitDiffPanel: () => <div data-testid="focused-diff" />,
}));

vi.mock('./components/commitDiffPanel/fullCommitDiffPanel', () => ({
    FullCommitDiffPanel: () => <div data-testid="full-diff" />,
}));

vi.mock('./components/commitHistoryPanel/commitsPanel', () => ({
    CommitsPanel: () => <div data-testid="commits" />,
}));

vi.mock('./components/treePreviewPanel/treePreviewPanel', () => ({
    TreePreviewPanel: () => <div data-testid="tree-preview" />,
}));

afterEach(() => {
    cleanup();
});

const renderBrowsePage = async (searchParams: Record<string, string | undefined>) => {
    render(await BrowsePage({
        params: Promise.resolve({
            path: 'github.com/sourcebot-dev/sourcebot@main/-/blob/README.md'.split('/'),
        }),
        searchParams: Promise.resolve(searchParams),
    }));
};

describe('BrowsePage markdown view routing', () => {
    test('forces source view when a blob highlight range is present', async () => {
        await renderBrowsePage({
            highlightRange: '12,12',
        });

        expect(screen.getByTestId('code-preview').textContent).toBe('source');
    });

    test('keeps focused diff routing ahead of blob source view', async () => {
        await renderBrowsePage({
            ref: 'abc123456789',
            diff: 'true',
            view: 'source',
        });

        expect(screen.queryByTestId('code-preview')).toBeNull();
        expect(screen.getByTestId('focused-diff')).toBeTruthy();
    });
});
