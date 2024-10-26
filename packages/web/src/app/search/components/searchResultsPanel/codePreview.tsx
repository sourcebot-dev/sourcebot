'use client';

import { SearchResultRange } from "@/lib/types";
import { EditorState, StateField, Transaction } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, lineNumbers } from "@codemirror/view";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { useEffect, useRef } from "react";
import { lineOffsetExtension } from "@/lib/extensions/lineOffsetExtension";
import { getSyntaxHighlightingExtension } from "@/hooks/useSyntaxHighlightingExtension";
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

    const containerRef = useRef<HTMLDivElement | null>(null);
    const { theme } = useThemeNormalized();

    useEffect(() => {
        if (!containerRef.current) {
            return;
        }

        const state = EditorState.create({
            doc: content,
            extensions: [
                EditorView.editable.of(false),
                lineNumbers(),
                lineOffsetExtension(lineOffset),
                syntaxHighlighting(defaultHighlightStyle),
                getSyntaxHighlightingExtension(language),
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
                            });
    
                        return Decoration.set(decorations);
                    },
                    update(highlights: DecorationSet, _transaction: Transaction) {
                        return highlights;
                    },
                    provide: (field) => EditorView.decorations.from(field),
                }),
                getSyntaxHighlightingExtension(language),
            ],
        });

        const view = new EditorView({
            state,
            parent: containerRef.current,
        });

        return () => {
            view.destroy();
        }
    }, [content, language, lineOffset, theme]);

    return (
        <div
            ref={containerRef}
        />
    )

}