import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SearchResultFile } from '@/features/search';
import { SearchResultsPanel } from '.';

const mocks = vi.hoisted(() => ({
    onResultClick: () => {},
    virtualizerOptions: [] as Array<{
        count: number;
        initialOffset?: number;
        initialMeasurementsCache?: unknown[];
    }>,
    fileMatchContainerProps: [] as Array<{
        file: SearchResultFile;
        showAllMatches: boolean;
    }>,
}));

vi.mock('@uidotdev/usehooks', () => ({
    useDebounce: <T,>(value: T) => value,
}));

vi.mock('@tanstack/react-virtual', () => ({
    useVirtualizer: (options: {
        count: number;
        initialOffset?: number;
        initialMeasurementsCache?: unknown[];
    }) => {
        mocks.virtualizerOptions.push(options);
        const measurementsCache = Array.from({ length: options.count }, (_, index) => ({
            key: index,
            index,
            start: index * 100,
            end: (index + 1) * 100,
            size: 100,
            lane: 0,
        }));

        return {
            scrollOffset: options.initialOffset ?? 0,
            measurementsCache,
            scrollToIndex: () => {},
            measureElement: () => {},
            getTotalSize: () => measurementsCache.length * 100,
            getVirtualItems: () => measurementsCache.slice(0, 1),
        };
    },
}));

vi.mock('./fileMatchContainer', () => ({
    MAX_MATCHES_TO_PREVIEW: 3,
    FileMatchContainer: (props: { file: SearchResultFile; showAllMatches: boolean }) => {
        mocks.fileMatchContainerProps.push(props);
        return (
            <a
                href={`/browse/${props.file.fileName.text}`}
                onClick={(event) => {
                    event.preventDefault();
                    mocks.onResultClick();
                }}
            >
                {props.file.fileName.text}
            </a>
        );
    },
}));

const nativeReplaceState = window.history.replaceState.bind(window.history);

const createFile = (fileName: string, repository = 'repo-one'): SearchResultFile => ({
    fileName: {
        text: fileName,
        matchRanges: [],
    },
    webUrl: '',
    repository,
    repositoryId: 1,
    language: 'TypeScript',
    branches: ['main'],
    chunks: [],
});

afterEach(() => {
    cleanup();
    window.history.replaceState = nativeReplaceState;
    nativeReplaceState({}, '');
    mocks.onResultClick = () => {};
    mocks.virtualizerOptions.length = 0;
    mocks.fileMatchContainerProps.length = 0;
});

describe('SearchResultsPanel history state', () => {
    it('does not cancel result navigation when streamed measurements update', async () => {
        const nextHistoryState = {
            tree: ['search'],
            renderedSearch: '?query=useState',
        };
        const restoredMeasurements = [{
            key: 0,
            index: 0,
            start: 0,
            end: 100,
            size: 100,
            lane: 0,
        }];
        nativeReplaceState({
            __NA: true,
            __PRIVATE_NEXTJS_INTERNALS_TREE: nextHistoryState,
            scrollOffset: 240,
            measurementsCache: restoredMeasurements,
            showAllMatchesMap: [['repo-one-src/index.ts', true]],
        }, '', '/search?query=useState');

        const browseUrl = '/browse/repo-one/src/index.ts';
        let isNavigationPending = false;
        let navigationCancelled = false;
        let resolveNavigation: () => void = () => {};
        const navigationReady = new Promise<void>((resolve) => {
            resolveNavigation = resolve;
        });
        const completeNavigation = async () => {
            isNavigationPending = true;
            await navigationReady;
            if (!navigationCancelled) {
                nativeReplaceState(window.history.state, '', browseUrl);
            }
            isNavigationPending = false;
        };
        let navigationResult: Promise<void> | undefined;
        mocks.onResultClick = () => {
            navigationResult = completeNavigation();
        };

        const replaceStateCalls: Array<{
            data: unknown;
            argumentCount: number;
        }> = [];
        // Mirror Next.js 16's external replaceState patch: copy its internal
        // state and restore the supplied URL, preempting a pending navigation.
        window.history.replaceState = function replaceState(data, unused, url) {
            replaceStateCalls.push({
                data,
                argumentCount: arguments.length,
            });

            const customState = data as Record<string, unknown> | null;
            if (customState?.__NA || customState?._N) {
                nativeReplaceState(data, unused, url);
                return;
            }

            const currentState = window.history.state as Record<string, unknown> | null;
            const stateWithNextInternals = {
                ...(customState ?? {}),
                ...(currentState?.__NA ? { __NA: currentState.__NA } : {}),
                ...(currentState?.__PRIVATE_NEXTJS_INTERNALS_TREE ? {
                    __PRIVATE_NEXTJS_INTERNALS_TREE: currentState.__PRIVATE_NEXTJS_INTERNALS_TREE,
                } : {}),
            };

            if (url) {
                navigationCancelled = isNavigationPending;
            }

            nativeReplaceState(stateWithNextInternals, unused, url);
        };

        const firstFile = createFile('src/index.ts');
        const secondFile = createFile('src/streamed.ts');
        const commonProps = {
            onOpenFilePreview: vi.fn(),
            isLoadMoreButtonVisible: false,
            onLoadMoreButtonClicked: vi.fn(),
            isBranchFilteringEnabled: false,
            repoInfo: {},
        };
        const { rerender } = render(
            <SearchResultsPanel fileMatches={[firstFile]} {...commonProps} />,
        );

        expect(mocks.virtualizerOptions[0]).toEqual(expect.objectContaining({
            initialOffset: 240,
            initialMeasurementsCache: restoredMeasurements,
        }));
        expect(mocks.fileMatchContainerProps[0].showAllMatches).toBe(true);

        fireEvent.click(screen.getByRole('link', { name: 'src/index.ts' }));
        expect(isNavigationPending).toBe(true);

        rerender(
            <SearchResultsPanel fileMatches={[firstFile, secondFile]} {...commonProps} />,
        );

        expect(isNavigationPending).toBe(true);
        expect(navigationCancelled).toBe(false);

        const latestReplaceStateCall = replaceStateCalls.at(-1);
        expect(latestReplaceStateCall?.argumentCount).toBe(2);
        expect(latestReplaceStateCall?.data).toEqual(expect.objectContaining({
            __NA: true,
            __PRIVATE_NEXTJS_INTERNALS_TREE: nextHistoryState,
            scrollOffset: 240,
            measurementsCache: expect.arrayContaining([
                expect.objectContaining({ index: 0 }),
                expect.objectContaining({ index: 1 }),
            ]),
        }));

        await act(async () => {
            resolveNavigation();
            await navigationResult;
        });

        expect(window.location.pathname).toBe(browseUrl);
    });
});
