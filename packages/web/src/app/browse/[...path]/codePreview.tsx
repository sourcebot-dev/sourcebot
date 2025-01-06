'use client';

import { useSyntaxHighlightingExtension } from "@/hooks/useSyntaxHighlightingExtension";
import { useThemeNormalized } from "@/hooks/useThemeNormalized";
import { search } from "@codemirror/search";
import CodeMirror, { EditorView, ReactCodeMirrorRef, SelectionRange, ViewUpdate } from "@uiw/react-codemirror";
import { useMemo, useRef, useState } from "react";
import { ContextMenu } from "./contextMenu";

interface CodePreviewProps {
    path: string;
    repoName: string;
    source: string;
    language: string;
}

export const CodePreview = ({
    source,
    language,
    path,
    repoName,
}: CodePreviewProps) => {
    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const syntaxHighlighting = useSyntaxHighlightingExtension(language, editorRef.current?.view);

    const [currentSelection, setCurrentSelection] = useState<SelectionRange>();

    const extensions = useMemo(() => {
        return [
            syntaxHighlighting,
            EditorView.lineWrapping,
            search({
                top: true,
            }),
            EditorView.updateListener.of((update: ViewUpdate) => {
                if (!update.selectionSet) {
                    return;
                }

                setCurrentSelection(update.state.selection.main);
            })
        ];
    }, [syntaxHighlighting]);

    const { theme } = useThemeNormalized();

    return (
        <>
            <CodeMirror
                className="relative"
                ref={editorRef}
                value={source}
                extensions={extensions}
                readOnly={true}
                theme={theme === "dark" ? "dark" : "light"}
            >
                {editorRef.current && editorRef.current.view && currentSelection && (
                    <ContextMenu
                        view={editorRef.current.view}
                        selection={currentSelection}
                        repoName={repoName}
                        path={path}
                    />
                )}
            </CodeMirror>
        </>
    )
}

