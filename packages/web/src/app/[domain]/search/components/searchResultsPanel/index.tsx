'use client';

import { Repository, SearchResultFile } from "@/features/search/types";
import { FileMatchContainer, MAX_MATCHES_TO_PREVIEW } from "./fileMatchContainer";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

interface SearchResultsPanelProps {
    fileMatches: SearchResultFile[];
    onOpenFileMatch: (fileMatch: SearchResultFile) => void;
    onMatchIndexChanged: (matchIndex: number) => void;
    isLoadMoreButtonVisible: boolean;
    onLoadMoreButtonClicked: () => void;
    isBranchFilteringEnabled: boolean;
    repoMetadata: Record<string, Repository>;
}

const ESTIMATED_LINE_HEIGHT_PX = 20;
const ESTIMATED_NUMBER_OF_LINES_PER_CODE_CELL = 10;
const ESTIMATED_MATCH_CONTAINER_HEIGHT_PX = 30;

export const SearchResultsPanel = ({
    fileMatches,
    onOpenFileMatch,
    onMatchIndexChanged,
    isLoadMoreButtonVisible,
    onLoadMoreButtonClicked,
    isBranchFilteringEnabled,
    repoMetadata,
}: SearchResultsPanelProps) => {
    const parentRef = useRef<HTMLDivElement>(null);
    const [showAllMatchesStates, setShowAllMatchesStates] = useState(Array(fileMatches.length).fill(false));
    const [lastShowAllMatchesButtonClickIndex, setLastShowAllMatchesButtonClickIndex] = useState(-1);

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
        enabled: true,
        overscan: 10,
        debug: false,
    });

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

    // Reset some state when the file matches change.
    useEffect(() => {
        setShowAllMatchesStates(Array(fileMatches.length).fill(false));
        virtualizer.scrollToIndex(0);
    }, [fileMatches, virtualizer]);

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
                                onOpenFile={() => {
                                    onOpenFileMatch(file);
                                }}
                                onMatchIndexChanged={(matchIndex) => {
                                    onMatchIndexChanged(matchIndex);
                                }}
                                showAllMatches={showAllMatchesStates[virtualRow.index]}
                                onShowAllMatchesButtonClicked={() => {
                                    onShowAllMatchesButtonClicked(virtualRow.index);
                                }}
                                isBranchFilteringEnabled={isBranchFilteringEnabled}
                                repoMetadata={repoMetadata}
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