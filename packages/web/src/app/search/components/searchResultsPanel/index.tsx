'use client';

import { SearchResultFile } from "@/lib/types";
import { FileMatchContainer } from "./fileMatchContainer";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";

interface SearchResultsPanelProps {
    fileMatches: SearchResultFile[];
    onOpenFileMatch: (fileMatch: SearchResultFile) => void;
    onMatchIndexChanged: (matchIndex: number) => void;
}

export const SearchResultsPanel = ({
    fileMatches,
    onOpenFileMatch,
    onMatchIndexChanged,
}: SearchResultsPanelProps) => {
    const parentRef = useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
        count: fileMatches.length,
        getScrollElement: () => parentRef.current,
        estimateSize: (index) => {
            const match = fileMatches[index];
            if (match.FileName) {
                return 30;
            }

            return 150;
        },
        measureElement: (element, entry, instance) => {
            // @see : https://github.com/TanStack/virtual/issues/659
            const direction = instance.scrollDirection;
            if (direction === "forward" || direction === null) {
                return element.scrollHeight;
            } else {
                // don't remeasure if we are scrolling up
                const indexKey = Number(element.getAttribute("data-index"));
                const cacheMeasurement = instance.itemSizeCache.get(indexKey);
                return cacheMeasurement;
            }
        },
        enabled: true,
        overscan: 10,
    });

    useEffect(() => {
        virtualizer.scrollToIndex(0);
        console.log('reset');
        // virtualizer.elementsCache.clear();
    }, [fileMatches]);

    const items = virtualizer.getVirtualItems();
    console.log(items.length);

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
                {items.map((virtualRow) => (
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
            <p>Load more</p>
        </div>
    )
}