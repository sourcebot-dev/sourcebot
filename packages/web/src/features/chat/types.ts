import { CreateUIMessage, UIMessage, UIMessagePart } from "ai";
import { BaseEditor, Descendant } from "slate";
import { HistoryEditor } from "slate-history";
import { ReactEditor, RenderElementProps } from "slate-react";
import { z } from "zod";
import { FindSymbolDefinitionsTool, FindSymbolReferencesTool, ReadFilesTool, SearchCodeTool } from "./tools";
import { toolNames } from "./constants";
import { LanguageModel } from "@sourcebot/schemas/v3/index.type";

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
    id: z.string(),
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
    modelName: z.string().optional(),
    totalInputTokens: z.number().optional(),
    totalOutputTokens: z.number().optional(),
    totalTokens: z.number().optional(),
    totalResponseTimeMs: z.number().optional(),
    feedback: z.object({
        type: z.enum(['like', 'dislike']),
        timestamp: z.string(), // ISO date string
        userId: z.string(),
    }).optional(),
    selectedRepos: z.array(z.string()).optional(),
    traceId: z.string().optional(),
});

export type SBChatMessageMetadata = z.infer<typeof sbChatMessageMetadataSchema>;

export type SBChatMessageToolTypes = {
    [toolNames.searchCode]: SearchCodeTool,
    [toolNames.readFiles]: ReadFilesTool,
    [toolNames.findSymbolReferences]: FindSymbolReferencesTool,
    [toolNames.findSymbolDefinitions]: FindSymbolDefinitionsTool,
}

export type SBChatMessageDataParts = {
    // The `source` data type allows us to know what sources the LLM saw
    // during retrieval.
    "source": Source,
}

export type SBChatMessage = UIMessage<
    SBChatMessageMetadata,
    SBChatMessageDataParts,
    SBChatMessageToolTypes
>;

export type SBChatMessagePart = UIMessagePart<
    SBChatMessageDataParts,
    SBChatMessageToolTypes
>;

// Slate specific types //

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

export type MentionData = FileMentionData;

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

/////////////////////////

// Misc //
export const SET_CHAT_STATE_QUERY_PARAM = 'setChatState';

export type SetChatStatePayload = {
    inputMessage: CreateUIMessage<SBChatMessage>;
    selectedRepos: string[];
}


export type LanguageModelProvider = LanguageModel['provider'];

// This is a subset of information about a configured
// language model that we can safely send to the client.
export type LanguageModelInfo = {
    provider: LanguageModelProvider,
    model: LanguageModel['model'],
    displayName?: LanguageModel['displayName'],
}

// Additional request body data that we send along to the chat API.
export const additionalChatRequestParamsSchema = z.object({
    languageModelId: z.string(),
    selectedRepos: z.array(z.string()),
});
export type AdditionalChatRequestParams = z.infer<typeof additionalChatRequestParamsSchema>;