'use client';

import { EditorView } from "@codemirror/view";
import { useExtensionWithDependency } from "./useExtensionWithDependency";
import { javascript } from "@codemirror/lang-javascript";

export const useSyntaxHighlightingExtension = (language: string, view: EditorView | undefined) => {
    const extension = useExtensionWithDependency(
        view ?? null,
        () => {
            switch (language.toLowerCase()) {
                case "typescript":
                case "javascript":
                    return javascript({
                        jsx: true,
                        typescript: true,
                    });
                default:
                    return [];
            }
        },
        [language]
    );

    return extension;
}