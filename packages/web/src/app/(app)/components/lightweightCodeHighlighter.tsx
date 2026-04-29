import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useCodeMirrorHighlighter } from '@/hooks/useCodeMirrorHighlighter'
import tailwind from '@/tailwind'
import { measure } from '@/lib/utils'
import { highlightCode } from '@/lib/codeHighlight'
import { SourceRange } from '@/features/search'
import { CopyIconButton } from './copyIconButton'

interface LightweightCodeHighlighter {
    language: string;
    children: string;
    /* 1-based highlight ranges */
    highlightRanges?: SourceRange[];
    lineNumbers?: boolean;
    /* 1-based line number offset */
    lineNumbersOffset?: number;
    renderWhitespace?: boolean;
    isCopyButtonVisible?: boolean;
}

// The maximum number of characters per line that we will display in the preview.
const MAX_NUMBER_OF_CHARACTER_PER_LINE = 1000;

/**
 * Lightweight code highlighter that uses the Lezer parser to highlight code.
 * This is helpful in scenarios where we need to highlight a ton of code snippets
 * (e.g., code nav, search results, etc)., but can't use the full-blown CodeMirror
 * editor because of perf issues.
 * 
 * Inspired by: https://github.com/craftzdog/react-codemirror-runmode
 */
export const LightweightCodeHighlighter = memo<LightweightCodeHighlighter>((props: LightweightCodeHighlighter) => {
    const {
        language,
        children: code,
        highlightRanges,
        lineNumbers = false,
        lineNumbersOffset = 1,
        renderWhitespace = false,
        isCopyButtonVisible = false,
    } = props;

    const unhighlightedLines = useMemo(() => {
        return code.trimEnd().split('\n');
    }, [code]);

    const isFileTooLargeToDisplay = useMemo(() => {
        return unhighlightedLines.some(line => line.length > MAX_NUMBER_OF_CHARACTER_PER_LINE);
    }, [unhighlightedLines]);

    const [highlightedLines, setHighlightedLines] = useState<React.ReactNode[] | null>(null);

    const highlightStyle = useCodeMirrorHighlighter();

    useEffect(() => {
        if (isFileTooLargeToDisplay) {
            return;
        }

        measure(() => Promise.all(
            unhighlightedLines
                .map(async (line, index) => {
                    const lineNumber = index + lineNumbersOffset;

                    // @todo: we will need to handle the case where a range spans multiple lines.
                    const ranges = highlightRanges?.filter(range => {
                        return range.start.lineNumber === lineNumber || range.end.lineNumber === lineNumber;
                    }).map(range => ({
                        from: range.start.column - 1,
                        to: range.end.column - 1,
                    }));

                    const snippets = await highlightCode(
                        language,
                        line,
                        highlightStyle,
                        ranges,
                        (text: string, style: string | null, from: number) => {
                            return (
                                <span
                                    key={from}
                                    className={`${style || ''}`}
                                >
                                    {text}
                                </span>
                            )
                        }
                    );

                    return <span key={index}>{snippets}</span>
                })
        ).then(highlightedLines => {
            setHighlightedLines(highlightedLines);
        }), 'highlightCode', /* outputLog = */ false);
    }, [
        language,
        code,
        highlightRanges,
        highlightStyle,
        unhighlightedLines,
        lineNumbersOffset,
        isFileTooLargeToDisplay,
    ]);

    const onCopy = useCallback(() => {
        try {
            navigator.clipboard.writeText(code);
            return true;
        } catch {
            return false;
        }
    }, [code]);

    const lineCount = (highlightedLines ?? unhighlightedLines).length + lineNumbersOffset;
    const lineNumberDigits = String(lineCount).length;
    const lineNumberWidth = `${lineNumberDigits + 2}ch`; // +2 for padding

    if (isFileTooLargeToDisplay) {
        return (
            <div className="font-mono text-sm px-2">
                File too large to display in preview.
            </div>
        );
    }

    return (
        <div className="relative group">
            {isCopyButtonVisible && (
                <CopyIconButton
                    onCopy={onCopy}
                    className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity group-hover:bg-background"
                />
            )}
            <div
                style={{
                    fontFamily: tailwind.theme.fontFamily.editor,
                    fontSize: tailwind.theme.fontSize.editor,
                    whiteSpace: renderWhitespace ? 'pre-wrap' : 'none',
                    wordBreak: 'break-all',
                }}
            >
                {(highlightedLines ?? unhighlightedLines).map((line, index) => (
                    <div
                        key={index}
                        className="flex"
                    >
                        {lineNumbers && (
                            <span
                                style={{
                                    width: lineNumberWidth,
                                    minWidth: lineNumberWidth,
                                    display: 'inline-block',
                                    textAlign: 'left',
                                    paddingLeft: '5px',
                                    userSelect: 'none',
                                    WebkitUserSelect: 'none',
                                    fontFamily: tailwind.theme.fontFamily.editor,
                                    color: tailwind.theme.colors.editor.gutterForeground,
                                }}
                            >
                                {index + lineNumbersOffset}
                            </span>
                        )}
                        <span
                            style={{
                                flex: 1,
                                paddingLeft: '6px',
                                paddingRight: '2px',
                            }}
                        >
                            {line}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
})

LightweightCodeHighlighter.displayName = 'LightweightCodeHighlighter';
