'use client';

import { FileDiff } from "@/features/git";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { FileDiffRow } from "./fileDiffRow";

interface FileDiffListProps {
    files: FileDiff[];
}

// Constants used to estimate row height up front so the virtualizer can size
// the scroll area before any rows have actually been measured. The values are
// approximate - the virtualizer re-measures each row after mount via
// `measureElement`, so the estimate only affects initial scrollbar accuracy
// and overscan placement.
const ROW_HEADER_PX = 40;
const LINE_HEIGHT_PX = 18;
const MIN_ROW_HEIGHT_PX = 200;
const CONTEXT_LINES_PER_HUNK = 6;

const estimateRowHeight = (file: FileDiff): number => {
    const visibleLines = file.hunks.reduce((sum, hunk) => {
        return sum + Math.max(hunk.oldRange.lines, hunk.newRange.lines) + CONTEXT_LINES_PER_HUNK;
    }, 0);

    const estimated = ROW_HEADER_PX + visibleLines * LINE_HEIGHT_PX;
    return Math.max(estimated, MIN_ROW_HEIGHT_PX);
};

export const FileDiffList = ({ files }: FileDiffListProps) => {
    const parentRef = useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
        count: files.length,
        getScrollElement: () => parentRef.current,
        estimateSize: (index) => estimateRowHeight(files[index]),
        overscan: 6,
    });

    return (
        <div
            ref={parentRef}
            className="flex-1 min-h-0"
            style={{
                width: '100%',
                overflowY: 'auto',
                contain: 'strict',
            }}
        >
            <div
                style={{
                    height: virtualizer.getTotalSize(),
                    width: '100%',
                    position: 'relative',
                }}
            >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                    const file = files[virtualRow.index];
                    const rowKey = file.newPath ?? file.oldPath ?? `idx-${virtualRow.index}`;
                    return (
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
                            <FileDiffRow
                                key={rowKey}
                                file={file}
                                yOffset={virtualRow.start}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
