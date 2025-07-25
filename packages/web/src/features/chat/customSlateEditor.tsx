'use client';

import { Slate } from "slate-react";
import { useCustomSlateEditor } from "./useCustomSlateEditor";
import { CustomElement } from "./types";

interface CustomSlateEditorProps {
    children: React.ReactNode;
}

const initialValue: CustomElement[] = [
    {
        type: 'paragraph',
        children: [{ text: '' }],
    },
];

export const CustomSlateEditor = ({ children }: CustomSlateEditorProps) => {
    const editor = useCustomSlateEditor();

    return <Slate
        editor={editor}
        initialValue={initialValue}
    >
        {children}
    </Slate>;
}