import { CreateMessage } from "ai";
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

export const SET_CHAT_STATE_QUERY_PARAM = 'setChatState';

export type SetChatStatePayload = {
    inputMessage: CreateMessage;
    selectedRepos: string[];
}

export const SOURCEBOT_CHAT_MODEL_PROVIDER = [
    'anthropic',
    'openai',
    'google-generative-ai',
] as const;

export type ModelProvider = (typeof SOURCEBOT_CHAT_MODEL_PROVIDER)[number];

export type ModelProviderInfo = {
    provider: ModelProvider;
    model: string;
}