'use client';

import { getCodemirrorLanguage } from "@/lib/codemirrorLanguage";
import { lineOffsetExtension } from "@/lib/extensions/lineOffsetExtension";
import { SearchResultRange } from "@/lib/types";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState, StateField, Transaction } from "@codemirror/state";
import { defaultLightThemeOption, oneDarkHighlightStyle, oneDarkTheme } from "@uiw/react-codemirror";
import { Decoration, DecorationSet, EditorView, lineNumbers } from "@codemirror/view";
import { useMemo, useRef } from "react";
import { LightweightCodeMirror, CodeMirrorRef } from "./lightweightCodeMirror";
import { useThemeNormalized } from "@/hooks/useThemeNormalized";

const markDecoration = Decoration.mark({
    class: "cm-searchMatch-selected"
});

interface CodePreviewProps {
    content: string,
    language: string,
    ranges: SearchResultRange[],
    lineOffset: number,
}

export const CodePreview = ({
    content,
    language,
    ranges,
    lineOffset,
}: CodePreviewProps) => {
    const editorRef = useRef<CodeMirrorRef>(null);
    const { theme } = useThemeNormalized();

    const extensions = useMemo(() => {
        const codemirrorExtension = getCodemirrorLanguage(language);
        return [
            EditorView.editable.of(false),
            ...(theme === 'dark' ? [
                syntaxHighlighting(oneDarkHighlightStyle),
                oneDarkTheme,
            ] : [
                syntaxHighlighting(defaultHighlightStyle),
                defaultLightThemeOption,
            ]),
            lineNumbers(),
            lineOffsetExtension(lineOffset),
            codemirrorExtension ? codemirrorExtension : [],
            StateField.define<DecorationSet>({
                create(editorState: EditorState) {
                    const document = editorState.doc;

                    const decorations = ranges
                        .sort((a, b) => {
                            return a.Start.ByteOffset - b.Start.ByteOffset;
                        })
                        .filter(({ Start, End }) => {
                            const startLine = Start.LineNumber - lineOffset;
                            const endLine = End.LineNumber - lineOffset;

                            if (
                                startLine < 1 ||
                                endLine < 1 ||
                                startLine > document.lines ||
                                endLine > document.lines
                            ) {
                                return false;
                            }
                            return true;
                        })
                        .map(({ Start, End }) => {
                            const startLine = Start.LineNumber - lineOffset;
                            const endLine = End.LineNumber - lineOffset;

                            const from = document.line(startLine).from + Start.Column - 1;
                            const to = document.line(endLine).from + End.Column - 1;
                            return markDecoration.range(from, to);
                        })
                        .sort((a, b) => a.from - b.from);

                    return Decoration.set(decorations);
                },
                update(highlights: DecorationSet, _transaction: Transaction) {
                    return highlights;
                },
                provide: (field) => EditorView.decorations.from(field),
            }),
        ]
    }, [language, lineOffset, ranges, theme]);

    return (
        <LightweightCodeMirror
            ref={editorRef}
            value={content}
            extensions={extensions}
        />
    )

}
