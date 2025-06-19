'use client';

import { createEditor } from "slate";
import { useState } from "react";
import { withReact } from "slate-react";
import { withHistory } from "slate-history";
import { CustomEditor } from "./types";
import { Element } from "slate";

export const useCustomSlateEditor = () => {
    const [editor] = useState(() =>
        withMentions(
            withReact(
                withHistory(createEditor())
            )
        )
    );
    return editor;
}

const withMentions = (editor: CustomEditor) => {
    const { isInline, isVoid, markableVoid } = editor;

    editor.isInline = (element: Element) => {
        return element.type === 'mention' ? true : isInline(element)
    }

    editor.isVoid = (element: Element) => {
        return element.type === 'mention' ? true : isVoid(element)
    }

    editor.markableVoid = (element: Element) => {
        return element.type === 'mention' || markableVoid(element)
    }

    return editor
}
