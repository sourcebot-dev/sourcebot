import { BaseEditor, Descendant } from "slate";
import { HistoryEditor } from "slate-history";
import { ReactEditor, RenderElementProps } from "slate-react";


export type CustomText = { text: string; }

export type ParagraphElement = {
    type: 'paragraph'
    align?: string
    children: Descendant[];
}

export type FileMentionData = {
    type: 'file';
    repo: string;
    path: string;
    name: string;
    language: string;
    revision: string;
}

export type MentionElement = {
    type: 'mention';
    data: FileMentionData;
    children: CustomText[];
}

export type CustomElement =
    ParagraphElement |
    MentionElement
    ;


export type CustomEditor =
    BaseEditor &
    ReactEditor &
    HistoryEditor
    ;

export type RenderElementPropsFor<T> = RenderElementProps & {
    element: T
}

declare module 'slate' {
    interface CustomTypes {
        Editor: CustomEditor
        Element: CustomElement
        Text: CustomText
    }
}