'use client';

import { useCodeMirrorHighlighter } from "@/hooks/useCodeMirrorHighlighter";
import { getCodeParserByFilename } from "@/lib/codeHighlight";
import { DiffHunk } from "@/features/git";
import { presentableDiff } from "@codemirror/merge";
import { Parser } from "@lezer/common";
import { Highlighter, highlightTree } from "@lezer/highlight";
import { Fragment, ReactNode, useEffect, useMemo, useState } from "react";
import { DiffLine, parseHunkLines } from "./hunkParser";
import { pairForSplit, SplitRow } from "./splitPairing";

interface LightweightDiffViewerProps {
    hunks: DiffHunk[];
    oldPath: string | null;
    newPath: string | null;
}

const SIDE_BG: Record<'left' | 'right', Record<'add' | 'del' | 'context' | 'blank', string>> = {
    left: {
        add: '',
        del: 'bg-red-500/10',
        context: '',
        blank: 'bg-muted',
    },
    right: {
        add: 'bg-green-500/10',
        del: '',
        context: '',
        blank: 'bg-muted',
    },
};

const INNER_DIFF_BG: Record<'left' | 'right', string> = {
    left: 'bg-red-500/30',
    right: 'bg-green-500/30',
};

const MARKER: Record<'add' | 'del' | 'context', string> = {
    add: '+',
    del: '-',
    context: ' ',
};

// Mirrors `lightweightCodeHighlighter`: skip rendering when any line in the
// diff exceeds this length. Tree-sitter parsing + per-character span emission
// gets very expensive on minified files (one-line bundles, etc.), and the
// resulting display is unreadable anyway.
const MAX_NUMBER_OF_CHARACTER_PER_LINE = 1000;

export const LightweightDiffViewer = ({ hunks, oldPath, newPath }: LightweightDiffViewerProps) => {
    const filename = (newPath ?? oldPath ?? '').split('/').pop() ?? '';
    const highlighter = useCodeMirrorHighlighter();

    const [parser, setParser] = useState<Parser | null>(null);
    useEffect(() => {
        let cancelled = false;
        getCodeParserByFilename(filename).then((p) => {
            if (!cancelled) {
                setParser(p);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [filename]);

    const isDiffTooLargeToDisplay = useMemo(() => {
        return hunks.some((hunk) =>
            hunk.body.split('\n').some((line) => line.length > MAX_NUMBER_OF_CHARACTER_PER_LINE),
        );
    }, [hunks]);

    if (isDiffTooLargeToDisplay) {
        return (
            <div className="p-4 text-sm text-muted-foreground">
                Diff too large to display in preview.
            </div>
        );
    }

    return (
        <div
            className="font-mono text-xs leading-relaxed"
            style={{
                display: 'grid',
                // Six tracks total — three per side: line number, marker,
                // content. Using a single outer grid (with `subgrid` on the
                // side cells) ensures all rows share the same column widths,
                // so line numbers/markers/content stay aligned across rows.
                // `minmax(<min>, max-content)` for the line-number and marker
                // columns: when one side of the diff is entirely blank
                // (fully-added or fully-deleted files), there's nothing on that
                // side to size the column, and `max-content` collapses it to
                // zero. The minimums keep these columns at a consistent width
                // so the right side starts at the same X across files.
                gridTemplateColumns: 'minmax(2.5rem, max-content) minmax(1ch, max-content) minmax(0, 1fr) minmax(2.5rem, max-content) minmax(1ch, max-content) minmax(0, 1fr)',
                columnGap: '0px',
            }}
        >
            {hunks.map((hunk, hunkIdx) => {
                const lines = parseHunkLines(hunk);
                const rows = pairForSplit(lines);
                return (
                    <Fragment key={hunkIdx}>
                        <HunkHeader
                            hunk={hunk}
                            className={hunkIdx === 0 ? 'border-b' : 'border-y'}
                        />
                        {rows.map((row, rowIdx) => (
                            <SplitRowView
                                key={`${hunkIdx}-${rowIdx}`}
                                row={row}
                                parser={parser}
                                highlighter={highlighter}
                            />
                        ))}
                    </Fragment>
                );
            })}
        </div>
    );
};

const HunkHeader = ({ hunk, className = '' }: { hunk: DiffHunk; className?: string }) => {
    const range = `@@ -${hunk.oldRange.start},${hunk.oldRange.lines} +${hunk.newRange.start},${hunk.newRange.lines} @@`;
    return (
        <div
            className={`px-3 py-1 bg-muted text-muted-foreground text-xs ${className}`}
            style={{ gridColumn: '1 / -1' }}
        >
            <span>{range}</span>
            {hunk.heading && <span className="ml-2">{hunk.heading}</span>}
        </div>
    );
};

interface SplitRowViewProps {
    row: SplitRow;
    parser: Parser | null;
    highlighter: Highlighter;
}

const SplitRowView = ({ row, parser, highlighter }: SplitRowViewProps) => {
    // For paired modifications (both sides populated, neither is context),
    // run a character-level diff so we can mark the changed character ranges
    // within each line.
    const intra = useMemo(() => {
        if (!row.left || !row.right) {
            return null;
        }
        if (row.left.kind !== 'del' || row.right.kind !== 'add') {
            return null;
        }
        const changes = presentableDiff(row.left.content, row.right.content);
        return {
            leftRanges: changes.map((c) => ({ from: c.fromA, to: c.toA })),
            rightRanges: changes.map((c) => ({ from: c.fromB, to: c.toB })),
        };
    }, [row.left, row.right]);

    return (
        <>
            <SideCell
                line={row.left}
                side="left"
                parser={parser}
                highlighter={highlighter}
                innerDiffRanges={intra?.leftRanges}
            />
            <SideCell
                line={row.right}
                side="right"
                parser={parser}
                highlighter={highlighter}
                innerDiffRanges={intra?.rightRanges}
            />
        </>
    );
};

interface SideCellProps {
    line: DiffLine | null;
    side: 'left' | 'right';
    parser: Parser | null;
    highlighter: Highlighter;
    innerDiffRanges?: { from: number; to: number }[];
}

const SideCell = ({ line, side, parser, highlighter, innerDiffRanges }: SideCellProps) => {
    // Drawn on the left side's right edge to visually separate the two panes.
    const separator = side === 'left' ? 'border-r border-border' : '';

    if (!line) {
        return (
            <div
                className={`${SIDE_BG[side].blank} ${separator} px-2 py-px`}
                style={{ gridColumn: 'span 3' }}
                aria-hidden="true"
            />
        );
    }

    const lineNumber = side === 'left' ? line.oldLineNumber : line.newLineNumber;
    const bg = SIDE_BG[side][line.kind];
    const marker = MARKER[line.kind];

    return (
        <div
            className={`${bg} ${separator} items-start py-px`}
            style={{
                gridColumn: 'span 3',
                display: 'grid',
                // Inherit the outer grid's three corresponding column tracks
                // so line number / marker / content widths line up across
                // every row in this side of the viewer.
                gridTemplateColumns: 'subgrid',
            }}
        >
            <span className="text-muted-foreground select-none text-right tabular-nums px-2">
                {lineNumber ?? ''}
            </span>
            <span className="text-muted-foreground select-none">{marker}</span>
            <span className="whitespace-pre-wrap break-words pr-2">
                {renderLineContent(line.content, parser, highlighter, innerDiffRanges, INNER_DIFF_BG[side])}
            </span>
        </div>
    );
};

// Synchronous Lezer highlight + optional inner-diff overlay. Walks tokens
// returned by `highlightTree`, fills in unstyled gaps, and splits each token
// further at inner-diff range boundaries so we can apply the inner-diff class
// without breaking syntax classes.
const renderLineContent = (
    content: string,
    parser: Parser | null,
    highlighter: Highlighter,
    innerDiffRanges: { from: number; to: number }[] = [],
    innerDiffClass: string = '',
): ReactNode => {
    if (!content) {
        return null;
    }
    if (!parser) {
        return content;
    }

    const tree = parser.parse(content);
    const output: ReactNode[] = [];

    const emit = (from: number, to: number, syntaxClass: string | null) => {
        // Split [from, to) at inner-diff range boundaries so we can layer
        // the inner-diff background on top of the syntax color.
        let cursor = from;
        while (cursor < to) {
            const inDiff = isInRange(cursor, innerDiffRanges);
            let next = to;
            for (const r of innerDiffRanges) {
                if (r.from > cursor && r.from < next) {
                    next = r.from;
                }
                if (r.to > cursor && r.to < next) {
                    next = r.to;
                }
            }
            const text = content.slice(cursor, next);
            const className = [syntaxClass, inDiff ? innerDiffClass : null].filter(Boolean).join(' ');
            output.push(
                className
                    ? <span key={`${cursor}-${next}`} className={className}>{text}</span>
                    : <Fragment key={`${cursor}-${next}`}>{text}</Fragment>
            );
            cursor = next;
        }
    };

    let pos = 0;
    highlightTree(tree, highlighter, (from, to, classes) => {
        if (from > pos) {
            emit(pos, from, null);
        }
        emit(from, to, classes);
        pos = to;
    });
    if (pos < content.length) {
        emit(pos, content.length, null);
    }
    return output;
};

const isInRange = (index: number, ranges: { from: number; to: number }[]): boolean => {
    return ranges.some((r) => index >= r.from && index < r.to);
};
