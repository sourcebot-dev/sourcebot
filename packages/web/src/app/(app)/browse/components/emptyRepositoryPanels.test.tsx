import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { PureFileTreePanel } from './pureFileTreePanel';
import { PureTreePreviewPanel } from '../[...path]/components/treePreviewPanel/pureTreePreviewPanel';

vi.mock('@/app/(app)/browse/hooks/useBrowseParams', () => ({
    useBrowseParams: () => ({
        repoName: 'github.com/sourcebot-dev/empty',
        revisionName: 'HEAD',
        path: '',
        pathType: 'tree',
    }),
}));

vi.mock('@bprogress/next', () => ({
    useProgress: () => ({
        stop: vi.fn(),
    }),
}));

afterEach(() => {
    cleanup();
});

describe('empty repository browse panels', () => {
    test('tree preview panel shows a clear empty repository state', () => {
        render(<PureTreePreviewPanel items={[]} />);

        expect(screen.queryByText('This repository is empty')).toBeTruthy();
    });

    test('file tree panel shows a clear empty repository state', () => {
        render(
            <PureFileTreePanel
                tree={{
                    name: 'root',
                    path: '',
                    type: 'tree',
                    children: [],
                }}
                openPaths={new Set()}
                path=""
                onTreeNodeClicked={vi.fn()}
            />
        );

        expect(screen.queryByText('This repository is empty')).toBeTruthy();
    });
});
