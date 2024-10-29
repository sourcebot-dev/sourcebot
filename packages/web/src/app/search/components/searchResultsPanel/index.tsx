'use client';

import { SearchResultFile } from "@/lib/types";
import { FileMatchContainer, MAX_MATCHES_TO_PREVIEW } from "./fileMatchContainer";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";

interface SearchResultsPanelProps {
    fileMatches: SearchResultFile[];
    onOpenFileMatch: (fileMatch: SearchResultFile) => void;
    onMatchIndexChanged: (matchIndex: number) => void;
    isLoadMoreButtonVisible: boolean;
    onLoadMoreButtonClicked: () => void;
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
}: SearchResultsPanelProps) => {
    const parentRef = useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
        count: fileMatches.length,
        getScrollElement: () => parentRef.current,
        estimateSize: (index) => {
            const fileMatch = fileMatches[index];

            // Quick guesstimation ;) This needs to be quick since the virtualizer will
            // run this upfront for all items in the list.
            const numCodeCells = fileMatch.ChunkMatches
                .filter(match => !match.FileName)
                .slice(0, MAX_MATCHES_TO_PREVIEW).length
            const estimatedSize =
                numCodeCells * ESTIMATED_NUMBER_OF_LINES_PER_CODE_CELL * ESTIMATED_LINE_HEIGHT_PX +
                ESTIMATED_MATCH_CONTAINER_HEIGHT_PX;

            return estimatedSize;
        },
        measureElement: (element, _entry, instance) => {
            // @note : Stutters were appearing when scrolling upwards. The workaround is
            // to use the cached height of the element when scrolling up.
            // @see : https://github.com/TanStack/virtual/issues/659
            const direction = instance.scrollDirection;
            if (direction === "forward" || direction === null) {
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

    useEffect(() => {
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
                {virtualizer.getVirtualItems().map((virtualRow) => (
                    <div
                        key={virtualRow.key}
                        data-index={virtualRow.index}
                        ref={virtualizer.measureElement}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualRow.start}px)`,
                        }}
                    >
                        <FileMatchContainer
                            file={fileMatches[virtualRow.index]}
                            onOpenFile={() => {
                                onOpenFileMatch(fileMatches[virtualRow.index]);
                            }}
                            onMatchIndexChanged={(matchIndex) => {
                                onMatchIndexChanged(matchIndex);
                            }}
                        />
                    </div>
                ))}
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