import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorCode } from '@/lib/errorCodes';

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
    PathHeader: ({ path, revisionName }: { path: string; revisionName?: string }) => (
        <div data-testid="path-header">Path: {path}; Revision: {revisionName ?? 'default'}</div>
    ),
}));

vi.mock('./pureCodePreviewPanel', () => ({
    PureCodePreviewPanel: () => <div>Code preview</div>,
}));

vi.mock('@/ee/features/codeNav/components/symbolHoverPopup', () => ({
    SymbolHoverPopup: () => null,
}));

import { CodePreviewPanel } from './codePreviewPanel';

const renderCodePreviewPanel = async (props: Parameters<typeof CodePreviewPanel>[0]) => {
    return render(
        <TooltipProvider>
            {await CodePreviewPanel(props)}
        </TooltipProvider>
    );
};

afterEach(() => {
    cleanup();
});

describe('CodePreviewPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mocks.getRepoInfoByName.mockResolvedValue({
            name: 'github.com/sourcebot-dev/sourcebot',
            displayName: 'sourcebot-dev/sourcebot',
            codeHostType: 'github',
            externalWebUrl: 'https://github.com/sourcebot-dev/sourcebot',
        });
    });

    test('renders a browse 404 when the requested file does not exist', async () => {
        mocks.getFileSource.mockResolvedValue({
            statusCode: 404,
            errorCode: ErrorCode.FILE_NOT_FOUND,
            message: 'File "src/missing.ts" not found in repository "github.com/sourcebot-dev/sourcebot"',
        });

        await renderCodePreviewPanel({
            path: 'src/missing.ts',
            repoName: 'github.com/sourcebot-dev/sourcebot',
            revisionName: 'feature-branch',
        });

        expect(screen.queryByText('File not found')).toBeTruthy();
        expect(screen.queryAllByText(/src\/missing\.ts/).length).toBeGreaterThan(0);
        expect(screen.queryByText(/Error loading file source/)).toBeNull();
        expect(screen.getByRole('link', { name: 'Return to repository root' }).getAttribute('href')).toBe(
            '/browse/github.com/sourcebot-dev/sourcebot@feature-branch/-/tree'
        );
    });

    test('keeps preview 404 navigation anchored to the browse revision', async () => {
        mocks.getFileSource.mockResolvedValue({
            statusCode: 404,
            errorCode: ErrorCode.FILE_NOT_FOUND,
            message: 'File "src/missing.ts" not found in repository "github.com/sourcebot-dev/sourcebot"',
        });

        await renderCodePreviewPanel({
            path: 'src/missing.ts',
            repoName: 'github.com/sourcebot-dev/sourcebot',
            revisionName: 'main',
            previewRef: 'abc123def456',
        });

        expect(screen.queryByText('File not found')).toBeTruthy();
        expect(screen.getAllByText('abc123def456').length).toBeGreaterThan(0);
        expect(screen.getByRole('link', { name: 'Return to repository root' }).getAttribute('href')).toBe(
            '/browse/github.com/sourcebot-dev/sourcebot@main/-/tree'
        );
        expect(screen.getByRole('link', { name: 'Close preview' }).getAttribute('href')).toBe(
            '/browse/github.com/sourcebot-dev/sourcebot@main/-/blob/src%2Fmissing.ts'
        );
    });

    test('keeps successful preview header anchored to the browse revision', async () => {
        mocks.getFileSource.mockResolvedValue({
            source: 'const value = 1;\n',
            language: 'typescript',
        });

        await renderCodePreviewPanel({
            path: 'src/index.ts',
            repoName: 'github.com/sourcebot-dev/sourcebot',
            revisionName: 'main',
            previewRef: 'abc123def456',
        });

        expect(mocks.getFileSource).toHaveBeenCalledWith({
            path: 'src/index.ts',
            repo: 'github.com/sourcebot-dev/sourcebot',
            ref: 'abc123def456',
        }, { source: 'sourcebot-web-client' });
        expect(screen.getByTestId('path-header').textContent).toBe('Path: src/index.ts; Revision: main');

        const closePreviewLink = screen.getByRole('link', { name: 'Close preview' });
        expect(closePreviewLink.getAttribute('href')).toBe(
            '/browse/github.com/sourcebot-dev/sourcebot@main/-/blob/src%2Findex.ts'
        );
        expect(closePreviewLink.closest('button')).toBeNull();
    });
});
