import { CreateUIMessage, UIMessage } from "ai";
import { BaseEditor, Descendant } from "slate";
import { HistoryEditor } from "slate-history";
import { ReactEditor, RenderElementProps } from "slate-react";
import { z } from "zod";
import { AnswerTool, FindSymbolDefinitionsTool, FindSymbolReferencesTool, ReadFilesTool, SearchCodeTool } from "./tools";
import { toolNames } from "./constants";


const fileSourceSchema = z.object({
    type: z.literal('file'),
    repo: z.string(),
    path: z.string(),
    name: z.string(),
    language: z.string(),
    revision: z.string(),
});
export type FileSource = z.infer<typeof fileSourceSchema>;

export const sourceSchema = z.discriminatedUnion('type', [
    fileSourceSchema,
]);
export type Source = z.infer<typeof sourceSchema>;

const fileReferenceSchema = z.object({
    type: z.literal('file'),
    fileName: z.string(),
    range: z.object({
        startLine: z.number(),
        endLine: z.number(),
    }).optional(),
});
export type FileReference = z.infer<typeof fileReferenceSchema>;

export const referenceSchema = z.discriminatedUnion('type', [
    fileReferenceSchema,
]);
export type Reference = z.infer<typeof referenceSchema>;

export const sbChatMessageMetadataSchema = z.object({
    researchDuration: z.number().optional(),
    totalUsage: z.object({
        inputTokens: z.number().optional(),
        outputTokens: z.number().optional(),
        totalTokens: z.number().optional(),
        reasoningTokens: z.number().optional(),
        cachedInputTokens: z.number().optional(),
    }).optional(),
});

export type SBChatMessageMetadata = z.infer<typeof sbChatMessageMetadataSchema>;

export type SBChatMessageToolTypes = {
    [toolNames.searchCode]: SearchCodeTool,
    [toolNames.readFiles]: ReadFilesTool,
    [toolNames.findSymbolReferences]: FindSymbolReferencesTool,
    [toolNames.findSymbolDefinitions]: FindSymbolDefinitionsTool,
    [toolNames.answerTool]: AnswerTool,
}

export type SBChatMessage = UIMessage<SBChatMessageMetadata, {
    "source": Source,
}, SBChatMessageToolTypes>;

// Slate specific types //

export type CustomText = { text: string; }

export type ParagraphElement = {
    type: 'paragraph'
    align?: string
    children: Descendant[];
}

export type MentionElement = {
    type: 'mention';
    data: Source;
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

/////////////////////////

// Misc //
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