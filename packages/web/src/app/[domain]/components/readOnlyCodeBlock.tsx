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
    
        const highlightClasses = classes ? `${classes} matchHighlight` : 'matchHighlight';
    
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
    

    if (parser) {
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
    } else {
        return [callback(input, null, 0, input.length)]
    }
}

const isIndexHighlighted = (index: number, ranges: { from: number, to: number }[]) => {
    return ranges.some(range => index >= range.from && index < range.to);
}
