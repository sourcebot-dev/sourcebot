'use client';

import { RepositoryInfo, SearchResultFile } from "@/features/search/types";
import { FileMatchContainer, MAX_MATCHES_TO_PREVIEW } from "./fileMatchContainer";
import { useVirtualizer, VirtualItem } from "@tanstack/react-virtual";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDebounce } from "@uidotdev/usehooks";

interface SearchResultsPanelProps {
    fileMatches: SearchResultFile[];
    onOpenFilePreview: (fileMatch: SearchResultFile) => void;
    isLoadMoreButtonVisible: boolean;
    onLoadMoreButtonClicked: () => void;
    isBranchFilteringEnabled: boolean;
    repoInfo: Record<number, RepositoryInfo>;
}

const ESTIMATED_LINE_HEIGHT_PX = 20;
const ESTIMATED_NUMBER_OF_LINES_PER_CODE_CELL = 10;
const ESTIMATED_MATCH_CONTAINER_HEIGHT_PX = 30;

type ScrollHistoryState = {
    scrollOffset?: number;
    measurementsCache?: VirtualItem[];
    showAllMatchesStates?: boolean[];
}

export const SearchResultsPanel = ({
    fileMatches,
    onOpenFilePreview,
    isLoadMoreButtonVisible,
    onLoadMoreButtonClicked,
    isBranchFilteringEnabled,
    repoInfo,
}: SearchResultsPanelProps) => {
    const parentRef = useRef<HTMLDivElement>(null);
    const [lastShowAllMatchesButtonClickIndex, setLastShowAllMatchesButtonClickIndex] = useState(-1);

    // Restore the scroll offset, measurements cache, and other state from the history
    // state. This enables us to restore the scroll offset when the user navigates back
    // to the page.
    // @see: https://github.com/TanStack/virtual/issues/378#issuecomment-2173670081
    const {
        scrollOffset: restoreOffset,
        measurementsCache: restoreMeasurementsCache,
        showAllMatchesStates: restoreShowAllMatchesStates,
    } = history.state as ScrollHistoryState;

    const [showAllMatchesStates, setShowAllMatchesStates] = useState(restoreShowAllMatchesStates || Array(fileMatches.length).fill(false));

    const virtualizer = useVirtualizer({
        count: fileMatches.length,
        getScrollElement: () => parentRef.current,
        estimateSize: (index) => {
            const fileMatch = fileMatches[index];
            const showAllMatches = showAllMatchesStates[index];

            // Quick guesstimation ;) This needs to be quick since the virtualizer will
            // run this upfront for all items in the list.
            const numCodeCells = fileMatch.chunks
                .slice(0, showAllMatches ? fileMatch.chunks.length : MAX_MATCHES_TO_PREVIEW)
                .length;

            const estimatedSize =
                numCodeCells * ESTIMATED_NUMBER_OF_LINES_PER_CODE_CELL * ESTIMATED_LINE_HEIGHT_PX +
                ESTIMATED_MATCH_CONTAINER_HEIGHT_PX;

            return estimatedSize;
        },
        measureElement: (element, _entry, instance) => {
            // @note : Stutters were appearing when scrolling upwards. The workaround is
            // to use the cached height of the element when scrolling up.
            // @see : https://github.com/TanStack/virtual/issues/659
            const isCacheDirty = element.hasAttribute("data-cache-dirty");
            element.removeAttribute("data-cache-dirty");
            const direction = instance.scrollDirection;
            if (direction === "forward" || direction === null || isCacheDirty) {
                return element.scrollHeight;
            } else {
                const indexKey = Number(element.getAttribute("data-index"));
                // Unfortunately, the cache is a private property, so we need to
                // hush the TS compiler.
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                const cacheMeasurement = instance.itemSizeCache.get(indexKey);
                return cacheMeasurement;
            }
        },
        initialOffset: restoreOffset,
        initialMeasurementsCache: restoreMeasurementsCache,
        enabled: true,
        overscan: 10,
        debug: false,
    });

    const debouncedScrollOffset = useDebounce(virtualizer.scrollOffset, 100);

    useEffect(() => {
        history.replaceState(
            {
                scrollOffset: debouncedScrollOffset ?? undefined,
                measurementsCache: virtualizer.measurementsCache,
                showAllMatchesStates,
            } satisfies ScrollHistoryState,
            '',
            window.location.href
        );
    }, [debouncedScrollOffset, virtualizer.measurementsCache, showAllMatchesStates]);

    const onShowAllMatchesButtonClicked = useCallback((index: number) => {
        const states = [...showAllMatchesStates];
        states[index] = !states[index];
        setShowAllMatchesStates(states);
        setLastShowAllMatchesButtonClickIndex(index);
    }, [showAllMatchesStates]);

    // After the "show N more/less matches" button is clicked, the FileMatchContainer's
    // size can change considerably. In cases where N > 3 or 4 cells when collapsing,
    // a visual artifact can appear where there is a large gap between the now collapsed
    // container and the next container. This is because the container's height was not
    // re-calculated. To get arround this, we force a re-measure of the element AFTER
    // it was re-rendered (hence the useLayoutEffect).
    useLayoutEffect(() => {
        if (lastShowAllMatchesButtonClickIndex < 0) {
            return;
        }

        const element = virtualizer.elementsCache.get(lastShowAllMatchesButtonClickIndex);
        element?.setAttribute('data-cache-dirty', 'true');
        virtualizer.measureElement(element);

        setLastShowAllMatchesButtonClickIndex(-1);
    }, [lastShowAllMatchesButtonClickIndex, virtualizer]);

    return (
        <div
            ref={parentRef}
            style={{
                width: "100%",
                height: "100%",
                overflowY: 'auto',
                contain: 'strict',
            }}
        >
            <div
                style={{
                    height: virtualizer.getTotalSize(),
                    width: "100%",
                    position: "relative",
                }}
            >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                    const file = fileMatches[virtualRow.index];
                    return (
                        <div
                            key={virtualRow.key}
                            data-index={virtualRow.index}
                            ref={virtualizer.measureElement}
                            style={{
                                position: 'absolute',
                                transform: `translateY(${virtualRow.start}px)`,
                                top: 0,
                                left: 0,
                                width: '100%',
                            }}
                        >
                            <FileMatchContainer
                                file={file}
                                onOpenFilePreview={() => {
                                    onOpenFilePreview(file);
                                }}
                                showAllMatches={showAllMatchesStates[virtualRow.index]}
                                onShowAllMatchesButtonClicked={() => {
                                    onShowAllMatchesButtonClicked(virtualRow.index);
                                }}
                                isBranchFilteringEnabled={isBranchFilteringEnabled}
                                repoInfo={repoInfo}
                                yOffset={virtualRow.start}
                            />
                        </div>
                    )
                })}
            </div>
            {isLoadMoreButtonVisible && (
                <div className="p-3">
                    <span
                        className="cursor-pointer text-blue-500 hover:underline"
                        onClick={onLoadMoreButtonClicked}
                    >
                        Load more results
                    </span>
                </div>
            )}
        </div>
    )
}