import { Parser } from '@lezer/common';
import { LanguageDescription, StreamLanguage } from '@codemirror/language';
import { Highlighter, highlightTree } from '@lezer/highlight';
import { languages as builtinLanguages } from '@codemirror/language-data';

const plainTextLanguage = StreamLanguage.define({
    token(stream) {
        stream.next();
        return null;
    },
});

export const getCodeParserByLanguageName = async (languageName: string): Promise<Parser> => {
    if (!languageName) {
        return plainTextLanguage.parser;
    }
    const found = LanguageDescription.matchLanguageName(builtinLanguages, languageName, true);
    if (!found) {
        return plainTextLanguage.parser;
    }
    if (!found.support) {
        await found.load();
    }
    return found.support ? found.support.language.parser : plainTextLanguage.parser;
};

export const getCodeParserByFilename = async (filename: string): Promise<Parser> => {
    const found = LanguageDescription.matchFilename(builtinLanguages, filename);
    if (!found) {
        return plainTextLanguage.parser;
    }
    if (!found.support) {
        await found.load();
    }
    return found.support ? found.support.language.parser : plainTextLanguage.parser;
};

export async function highlightCode<Output>(
    languageName: string,
    input: string,
    highlighter: Highlighter,
    highlightRanges: { from: number; to: number }[] = [],
    callback: (
        text: string,
        style: string | null,
        from: number,
        to: number,
    ) => Output,
): Promise<Output[]> {
    const parser = await getCodeParserByLanguageName(languageName);

    const convertRangeToHighlightedSubranges = (
        from: number,
        to: number,
        classes: string | null,
        cb: (from: number, to: number, classes: string | null) => void,
    ) => {
        type HighlightRange = {
            from: number;
            to: number;
            isHighlighted: boolean;
        };

        const highlightClasses = classes
            ? `${classes} searchMatch-selected`
            : 'searchMatch-selected';

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
                    );

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
            );
        }
    };

    const tree = parser.parse(input);
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
            });
        }

        convertRangeToHighlightedSubranges(from, to, classes, (from, to, classes) => {
            output.push(callback(input.slice(from, to), classes, from, to));
        });

        pos = to;
    });

    if (pos !== tree.length) {
        convertRangeToHighlightedSubranges(pos, tree.length, null, (from, to, classes) => {
            output.push(callback(input.slice(from, to), classes, from, to));
        });
    }
    return output;
}

const isIndexHighlighted = (index: number, ranges: { from: number; to: number }[]) => {
    return ranges.some((range) => index >= range.from && index < range.to);
};
