'use client';

import { EditorView, keymap } from "@uiw/react-codemirror";
import { useExtensionWithDependency } from "./useExtensionWithDependency";
import { useKeymapType } from "./useKeymapType";
import { defaultKeymap } from "@codemirror/commands";
import { vim } from "@replit/codemirror-vim";

export const useKeymapExtension = (view: EditorView | undefined) => {
    const [keymapType] = useKeymapType();

    const extension = useExtensionWithDependency(
        view ?? null,
        () => {
            switch (keymapType) {
                case "default":
                    return keymap.of(defaultKeymap);
                case "vim":
                    return vim();
            }
        },
        [keymapType]
    );

    return extension;
}