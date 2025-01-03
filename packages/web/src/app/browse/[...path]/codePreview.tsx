'use client';

import { useSyntaxHighlightingExtension } from "@/hooks/useSyntaxHighlightingExtension";
import { useThemeNormalized } from "@/hooks/useThemeNormalized";
import { search } from "@codemirror/search";
import CodeMirror, { EditorView, ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { useMemo, useRef } from "react";


interface CodePreviewProps {
    source: string;
    language: string;
}

export const CodePreview = ({
    source,
    language,
}: CodePreviewProps) => {
    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const syntaxHighlighting = useSyntaxHighlightingExtension(language, editorRef.current?.view);
    const extensions = useMemo(() => {
        return [
            syntaxHighlighting,
            EditorView.lineWrapping,
            search({
                top: true,
            }),
        ];
    }, [syntaxHighlighting]);
    const { theme } = useThemeNormalized();

    return (
        <CodeMirror
            ref={editorRef}
            value={source}
            extensions={extensions}
            theme={theme === "dark" ? "dark" : "light"}
        />
    )
}