import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
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
    PathHeader: ({ path }: { path: string }) => <div>Path: {path}</div>,
}));

vi.mock('./pureCodePreviewPanel', () => ({
    PureCodePreviewPanel: () => <div>Code preview</div>,
}));

vi.mock('@/ee/features/codeNav/components/symbolHoverPopup', () => ({
    SymbolHoverPopup: () => null,
}));

import { CodePreviewPanel } from './codePreviewPanel';

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

        render(await CodePreviewPanel({
            path: 'src/missing.ts',
            repoName: 'github.com/sourcebot-dev/sourcebot',
            revisionName: 'feature-branch',
        }));

        expect(screen.queryByText('File not found')).toBeTruthy();
        expect(screen.queryAllByText(/src\/missing\.ts/).length).toBeGreaterThan(0);
        expect(screen.queryByText(/Error loading file source/)).toBeNull();
        expect(screen.getByRole('link', { name: 'Return to repository root' }).getAttribute('href')).toBe(
            '/browse/github.com/sourcebot-dev/sourcebot@feature-branch/-/tree'
        );
    });
});
