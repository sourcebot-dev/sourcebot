'use client';

import { EditorView } from "@codemirror/view";
import { useExtensionWithDependency } from "./useExtensionWithDependency";
import { getCodemirrorLanguage } from "@/lib/codemirrorLanguage";

export const useCodeMirrorLanguageExtension = (linguistLanguage: string, view: EditorView | undefined) => {
    const extension = useExtensionWithDependency(
        view ?? null,
        () => {
            const codemirrorLanguage = getCodemirrorLanguage(linguistLanguage);
            return codemirrorLanguage ? codemirrorLanguage : [];
        },
        [linguistLanguage]
    );

    return extension;
}
