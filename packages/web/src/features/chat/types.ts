import { CreateUIMessage, UIDataTypes, UIMessage } from "ai";
import { BaseEditor, Descendant } from "slate";
import { HistoryEditor } from "slate-history";
import { ReactEditor, RenderElementProps } from "slate-react";
import { z } from "zod";
import { ToolTypes } from "./tools";

export type CustomText = { text: string; }

export type ParagraphElement = {
    type: 'paragraph'
    align?: string
    children: Descendant[];
}

const fileMentionDataSchema = z.object({
    type: z.literal('file'),
    repo: z.string(),
    path: z.string(),
    name: z.string(),
    language: z.string(),
    revision: z.string(),
});

export const mentionDataSchema = z.discriminatedUnion('type', [
    fileMentionDataSchema,
]);

export type MentionData = z.infer<typeof mentionDataSchema>;
export type MentionElement = {
    type: 'mention';
    data: MentionData;
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
    inputMessage: CreateUIMessage<SBChatMessage>;
    selectedRepos: string[];
}

export const SOURCEBOT_CHAT_MODEL_PROVIDER = [
    'anthropic',
    'openai',
    'google-generative-ai',
    'aws-bedrock',
] as const;

export type ModelProvider = (typeof SOURCEBOT_CHAT_MODEL_PROVIDER)[number];

export type ModelProviderInfo = {
    provider: ModelProvider;
    model: string;
    displayName?: string;
}

export const sbChatMessageMetadataSchema = z.object({
    reasoningDurations: z.array(z.number()).optional(),
    totalUsage: z.object({
        inputTokens: z.number().optional(),
        outputTokens: z.number().optional(),
        totalTokens: z.number().optional(),
        reasoningTokens: z.number().optional(),
        cachedInputTokens: z.number().optional(),
    }).optional(),
    mentions: z.array(mentionDataSchema).optional(),
});

export type SBChatMessageMetadata = z.infer<typeof sbChatMessageMetadataSchema>;
export type SBChatMessage = UIMessage<SBChatMessageMetadata, UIDataTypes, ToolTypes>;