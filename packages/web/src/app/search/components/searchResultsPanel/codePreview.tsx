'use client';

import { useExtensionWithDependency } from "@/hooks/useExtensionWithDependency";
import { syntaxHighlighting as syntaxHighlightingExtension, defaultHighlightStyle } from "@codemirror/language";
import { useSyntaxHighlightingExtension } from "@/hooks/useSyntaxHighlightingExtension";
import { useThemeNormalized } from "@/hooks/useThemeNormalized";
import { lineOffsetExtension } from "@/lib/extensions/lineOffsetExtension";
import { SearchResultRange } from "@/lib/types";
import { javascript } from "@codemirror/lang-javascript";
import CodeMirror, { Decoration, DecorationSet, EditorState, EditorView, lineNumbers, ReactCodeMirrorRef, StateField, Transaction, useCodeMirror } from "@uiw/react-codemirror";
import { basicLight, basicDark } from '@uiw/codemirror-theme-basic';
import { useEffect, useMemo, useRef, useState } from "react";

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

    // const editor = useRef<HTMLDivElement | null>(null);
    // const { setContainer } = useCodeMirror({
    //     container: editor.current,
    //     extensions,
    //     value: content,
    //     theme: "dark"
    // });

    // useEffect(() => {
    //     if (editor.current) {
    //         setContainer(editor.current);
    //     }
    // }, [editor.current]);

    // return <div ref={editor} />;

    // const editorRef = useRef<ReactCodeMirrorRef>(null);
    // const { theme } = useThemeNormalized();


    // const rangeHighlighting = useExtensionWithDependency(editorRef.current?.view ?? null, () => {
    //     return [
    //         StateField.define<DecorationSet>({
    //             create(editorState: EditorState) {
    //                 const document = editorState.doc;

    //                 const decorations = ranges
    //                     .sort((a, b) => {
    //                         return a.Start.ByteOffset - b.Start.ByteOffset;
    //                     })
    //                     .filter(({ Start, End }) => {
    //                         const startLine = Start.LineNumber - lineOffset;
    //                         const endLine = End.LineNumber - lineOffset;

    //                         if (
    //                             startLine < 1 ||
    //                             endLine < 1 ||
    //                             startLine > document.lines ||
    //                             endLine > document.lines
    //                         ) {
    //                             return false;
    //                         }
    //                         return true;
    //                     })
    //                     .map(({ Start, End }) => {
    //                         const startLine = Start.LineNumber - lineOffset;
    //                         const endLine = End.LineNumber - lineOffset;

    //                         const from = document.line(startLine).from + Start.Column - 1;
    //                         const to = document.line(endLine).from + End.Column - 1;
    //                         return markDecoration.range(from, to);
    //                     });

    //                 return Decoration.set(decorations);
    //             },
    //             update(highlights: DecorationSet, _transaction: Transaction) {
    //                 return highlights;
    //             },
    //             provide: (field) => EditorView.decorations.from(field),
    //         }),
    //     ];
    // }, [ranges, lineOffset]);

    // const extensions = useMemo(() => {
    //     return [
    //         syntaxHighlighting,
    //         // EditorView.lineWrapping,
    //         lineOffsetExtension(lineOffset),
    //         rangeHighlighting,
    //     ];
    // }, [syntaxHighlighting, lineOffset, rangeHighlighting]);


    const editorRef2 = useRef<HTMLDivElement>(null);
    // const syntaxHighlighting = useSyntaxHighlightingExtension(language, editorRef2.current?.view);

    useEffect(() => {
        const state = EditorState.create({
            doc: content,
            extensions: [
                EditorView.editable.of(false),
                // EditorView.lineWrapping,
                basicDark,
                syntaxHighlightingExtension(defaultHighlightStyle),
                javascript(),
                lineNumbers(),
                lineOffsetExtension(lineOffset),
                // rangeHighlighting,
            ],
        });

        const view = new EditorView({
            state,
            parent: editorRef2.current!,
        });

        return () => {
            view.destroy();
        }
    }, [lineOffset]);

    return (
        <div
            ref={editorRef2}
        />
    )

    // return (
    //     <CodeMirror
    //         ref={editorRef}
    //         readOnly={true}
    //         editable={false}
    //         value={content}
    //         theme={theme === "dark" ? "dark" : "light"}
    //         basicSetup={{
    //             lineNumbers: true,
    //             syntaxHighlighting: true,

    //             // Disable all this other stuff...
    //             ... {
    //                 foldGutter: false,
    //                 highlightActiveLineGutter: false,
    //                 highlightSpecialChars: false,
    //                 history: false,
    //                 drawSelection: false,
    //                 dropCursor: false,
    //                 allowMultipleSelections: false,
    //                 indentOnInput: false,
    //                 bracketMatching: false,
    //                 closeBrackets: false,
    //                 autocompletion: false,
    //                 rectangularSelection: false,
    //                 crosshairCursor: false,
    //                 highlightActiveLine: false,
    //                 highlightSelectionMatches: false,
    //                 closeBracketsKeymap: false,
    //                 defaultKeymap: false,
    //                 searchKeymap: false,
    //                 historyKeymap: false,
    //                 foldKeymap: false,
    //                 completionKeymap: false,
    //                 lintKeymap: false,
    //             }
    //         }}
    //         extensions={extensions}
    //     />
    // )
}