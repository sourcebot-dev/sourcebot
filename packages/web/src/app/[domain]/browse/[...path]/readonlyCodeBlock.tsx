import { Parser } from '@lezer/common'
import { Language, LanguageDescription } from '@codemirror/language'
import { Highlighter, highlightTree } from '@lezer/highlight'
import { languages as builtinLanguages } from '@codemirror/language-data'
import { memo, useEffect, useState } from 'react'

interface ReadOnlyCodeBlockProps {
    language: string;
    children: string;
    theme: Highlighter;
    fallbackLanguage?: Language;
    languages?: LanguageDescription[];
    highlightRanges?: { from: number, to: number }[];
}

export const ReadOnlyCodeBlock = memo<ReadOnlyCodeBlockProps>((props: ReadOnlyCodeBlockProps) => {
    const {
        language,
        children: code,
        theme,
        fallbackLanguage,
        languages,
        highlightRanges,
    } = props
    const [highlightedCode, setHighlightedCode] = useState<React.ReactNode[] | null>(null)

    useEffect(() => {
        highlightCode(
            language,
            code,
            theme,
            fallbackLanguage,
            languages,
            highlightRanges,
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
        ).then(setHighlightedCode)
    }, [language, code, theme, fallbackLanguage, languages, highlightRanges])

    return <div className="font-mono text-sm">{highlightedCode || code}</div>
})

ReadOnlyCodeBlock.displayName = 'ReadOnlyCodeBlock';

async function getCodeParser(
    languageName: string,
    fallbackLanguage?: Language,
    languages: LanguageDescription[] = builtinLanguages
): Promise<Parser | null> {
    if (languageName) {
        const found = LanguageDescription.matchLanguageName(
            languages,
            languageName,
            true
        )
        if (found instanceof LanguageDescription) {
            if (!found.support) await found.load()
            return found.support ? found.support.language.parser : null
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } else if (found) return (found as unknown as any).parser
    }
    return fallbackLanguage ? fallbackLanguage.parser : null
}

async function highlightCode<Output>(
    languageName: string,
    input: string,
    highlighter: Highlighter,
    fallbackLanguage: Language | undefined,
    languages: LanguageDescription[] | undefined,
    highlightRanges: { from: number, to: number }[] = [],
    callback: (
        text: string,
        style: string | null,
        from: number,
        to: number
    ) => Output,
): Promise<Output[]> {
    const parser = await getCodeParser(languageName, fallbackLanguage, languages);

    if (parser) {
        const tree = parser.parse(input)
        const output: Array<Output> = [];

        // @see: https://discuss.codemirror.net/t/static-highlighting-using-cm-v6/3420/2
        let pos = 0;
        // eslint-disable-next-line no-debugger
        highlightTree(tree, highlighter, (from, to, classes) => {
            if (from > pos) {
                const { output: highlightRangesOutput } = splitRangeByHighlightRanges({ from: pos, to: from }, highlightRanges);
                for (const range of highlightRangesOutput) {
                    const className = range.isHighlighted ? `matchHighlight` : null;
                    output.push(callback(input.slice(range.from, range.to), className, range.from, range.to));
                }
            }

            const { output: highlightRangesOutput } = splitRangeByHighlightRanges({ from, to }, highlightRanges);
            for (const range of highlightRangesOutput) {
                const className = range.isHighlighted ? `${classes} matchHighlight` : classes;
                output.push(callback(input.slice(range.from, range.to), className, range.from, range.to));
            }

            pos = to;
        })
        if (pos != tree.length) {
            const { output: highlightRangesOutput } = splitRangeByHighlightRanges({
                from: pos,
                to: tree.length,
            }, highlightRanges);

            for (const range of highlightRangesOutput) {
                const className = range.isHighlighted ? `matchHighlight` : null;
                output.push(callback(input.slice(range.from, range.to), className, range.from, range.to));
            }
        }
        return output;
    } else {
        return [callback(input, null, 0, input.length)]
    }
}

const isIndexHighlighted = (ranges: { from: number, to: number }[], index: number) => {
    return ranges.some(range => index >= range.from && index < range.to);
}

const splitRangeByHighlightRanges = (
    range: { from: number, to: number },
    highlightRanges: { from: number, to: number }[]
) => {
    type HighlightRange = {
        from: number,
        to: number,
        isHighlighted: boolean,
    }

    const output: HighlightRange[] = [];

    let currentRange: HighlightRange | null = null;
    for (let i = range.from; i < range.to; i++) {
        const isHighlighted = isIndexHighlighted(highlightRanges, i);
        
        if (currentRange) {
            if (currentRange.isHighlighted === isHighlighted) {
                currentRange.to = i + 1;
            } else {
                output.push({
                    from: currentRange.from,
                    to: currentRange.to,
                    isHighlighted: currentRange.isHighlighted,
                });
                
                currentRange = { from: i, to: i + 1, isHighlighted };
            }
        } else {
            currentRange = { from: i, to: i + 1, isHighlighted };
        }
    }

    if (currentRange) {
        output.push({
            from: currentRange.from,
            to: currentRange.to,
            isHighlighted: currentRange.isHighlighted,
        });
    }

    return {
        output,
    }
}
