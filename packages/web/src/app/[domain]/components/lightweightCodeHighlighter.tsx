import { Parser } from '@lezer/common'
import { LanguageDescription, StreamLanguage } from '@codemirror/language'
import { Highlighter, highlightTree } from '@lezer/highlight'
import { languages as builtinLanguages } from '@codemirror/language-data'
import { memo, useEffect, useMemo, useState } from 'react'
import { useCodeMirrorHighlighter } from '@/hooks/useCodeMirrorHighlighter'
import tailwind from '@/tailwind'
import { measure } from '@/lib/utils'
import { SourceRange } from '@/features/search/types'

// Define a plain text language
const plainTextLanguage = StreamLanguage.define({
    token(stream) {
        stream.next();
        return null;
    }
});

interface LightweightCodeHighlighter {
    language: string;
    children: string;
    /* 1-based highlight ranges */
    highlightRanges?: SourceRange[];
    lineNumbers?: boolean;
    /* 1-based line number offset */
    lineNumbersOffset?: number;
    renderWhitespace?: boolean;
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
    } = props;

    const unhighlightedLines = useMemo(() => {
        return code.trimEnd().split('\n');
    }, [code]);

    const isFileTooLargeToDisplay = useMemo(() => {
        return unhighlightedLines.some(line => line.length > MAX_NUMBER_OF_CHARACTER_PER_LINE);
    }, [code]);

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
        lineNumbersOffset
    ]);

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
                                fontFamily: tailwind.theme.fontFamily.editor,
                                color: tailwind.theme.colors.editor.gutterForeground,
                            }}
                        >
                            {index + lineNumbersOffset}
                        </span>
                    )}
                    <span
                        className="cm-line"
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
    )
})

LightweightCodeHighlighter.displayName = 'LightweightCodeHighlighter';

async function getCodeParser(
    languageName: string,
): Promise<Parser> {
    if (languageName) {
        const parser = await (async () => {
            const found = LanguageDescription.matchLanguageName(
                builtinLanguages,
                languageName,
                true
            );

            if (!found) {
                return null;
            }

            if (!found.support) { 
                await found.load();
            }
            return found.support ? found.support.language.parser : null;
        })();

        if (parser) {
            return parser;
        }
    }
    return plainTextLanguage.parser;
}

async function highlightCode<Output>(
    languageName: string,
    input: string,
    highlighter: Highlighter,
    highlightRanges: { from: number, to: number }[] = [],
    callback: (
        text: string,
        style: string | null,
        from: number,
        to: number
    ) => Output,
): Promise<Output[]> {
    const parser = await getCodeParser(languageName);

    /**
     * Converts a range to a series of highlighted subranges.
     */
    const convertRangeToHighlightedSubranges = (
        from: number,
        to: number,
        classes: string | null,
        cb: (from: number, to: number, classes: string | null) => void,
    ) => {
        type HighlightRange = {
            from: number,
            to: number,
            isHighlighted: boolean,
        }

        const highlightClasses = classes ? `${classes} searchMatch-selected` : 'searchMatch-selected';

        let currentRange: HighlightRange | null = null;
        for (let i = from; i < to; i++) {
            const isHighlighted = isIndexHighlighted(i, highlightRanges);

            if (currentRange) {
                if (currentRange.isHighlighted === isHighlighted) {
                    currentRange.to = i + 1;
                } else {
                    cb(
                        currentRange.from,
                        currentRange.to,
                        currentRange.isHighlighted ? highlightClasses : classes,
                    )

                    currentRange = { from: i, to: i + 1, isHighlighted };
                }
            } else {
                currentRange = { from: i, to: i + 1, isHighlighted };
            }
        }

        if (currentRange) {
            cb(
                currentRange.from,
                currentRange.to,
                currentRange.isHighlighted ? highlightClasses : classes,
            )
        }
    }

    const tree = parser.parse(input)
    const output: Array<Output> = [];

    let pos = 0;
    highlightTree(tree, highlighter, (from, to, classes) => {
        // `highlightTree` only calls this callback when at least one style/class
        // is applied to the text (i.e., `classes` is not empty). This means that
        // any unstyled regions will be skipped (e.g., whitespace, `=`. `;`. etc).
        // This check ensures that we process these unstyled regions as well.
        // @see: https://discuss.codemirror.net/t/static-highlighting-using-cm-v6/3420/2
        if (from > pos) {
            convertRangeToHighlightedSubranges(pos, from, null, (from, to, classes) => {
                output.push(callback(input.slice(from, to), classes, from, to));
            })
        }

        convertRangeToHighlightedSubranges(from, to, classes, (from, to, classes) => {
            output.push(callback(input.slice(from, to), classes, from, to));
        })

        pos = to;
    });

    // Process any remaining unstyled regions.
    if (pos != tree.length) {
        convertRangeToHighlightedSubranges(pos, tree.length, null, (from, to, classes) => {
            output.push(callback(input.slice(from, to), classes, from, to));
        })
    }
    return output;
}

const isIndexHighlighted = (index: number, ranges: { from: number, to: number }[]) => {
    return ranges.some(range => index >= range.from && index < range.to);
}
