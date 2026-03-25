import { CreateUIMessage, InferUITool, UIMessage, UIMessagePart } from "ai";
import { BaseEditor, Descendant } from "slate";
import { HistoryEditor } from "slate-history";
import { ReactEditor, RenderElementProps } from "slate-react";
import { z } from "zod";
import { LanguageModel } from "@sourcebot/schemas/v3/index.type";
import { createTools } from "./tools";
export { sourceSchema } from "@/features/tools/types";
export type { FileSource, Source } from "@/features/tools/types";
import type { Source } from "@/features/tools/types";

const fileReferenceSchema = z.object({
    type: z.literal('file'),
    id: z.string(),
    repo: z.string(),
    path: z.string(),
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

export const repoSearchScopeSchema = z.object({
    type: z.literal('repo'),
    value: z.string(),
    name: z.string(),
    codeHostType: z.string(),
});
export type RepoSearchScope = z.infer<typeof repoSearchScopeSchema>;

export const repoSetSearchScopeSchema = z.object({
    type: z.literal('reposet'),
    value: z.string(),
    name: z.string(),
    repoCount: z.number(),
});
export type RepoSetSearchScope = z.infer<typeof repoSetSearchScopeSchema>;

export const searchScopeSchema = z.discriminatedUnion('type', [
    repoSearchScopeSchema,
    repoSetSearchScopeSchema,
]);
export type SearchScope = z.infer<typeof searchScopeSchema>;

export const sbChatMessageMetadataSchema = z.object({
    modelName: z.string().optional(),
    totalInputTokens: z.number().optional(),
    totalOutputTokens: z.number().optional(),
    totalTokens: z.number().optional(),
    totalResponseTimeMs: z.number().optional(),
    feedback: z.array(z.object({
        type: z.enum(['like', 'dislike']),
        timestamp: z.string(), // ISO date string
        userId: z.string().optional(),
    })).optional(),
    selectedSearchScopes: z.array(searchScopeSchema).optional(),
    traceId: z.string().optional(),
});

export type SBChatMessageMetadata = z.infer<typeof sbChatMessageMetadataSchema>;

export type SBChatMessageToolTypes = {
    [K in keyof ReturnType<typeof createTools>]: InferUITool<ReturnType<typeof createTools>[K]>;
};

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
export type SetChatStatePayload = {
    inputMessage: CreateUIMessage<SBChatMessage>;
    selectedSearchScopes: SearchScope[];
}


export type LanguageModelProvider = LanguageModel['provider'];

export const languageModelProviders = [
    "amazon-bedrock",
    "anthropic",
    "azure",
    "deepseek",
    "google-generative-ai",
    "google-vertex-anthropic",
    "google-vertex",
    "mistral",
    "openai",
    "openai-compatible",
    "openrouter",
    "xai",
] as const satisfies readonly LanguageModelProvider[];

// Type-check assertion that ensure the above array is up to date
// with the LanguageModelProvider type.
type _AssertAllProviders = LanguageModelProvider extends typeof languageModelProviders[number] ? true : never;
const _assertAllProviders: _AssertAllProviders = true;
void _assertAllProviders;

export const languageModelInfoSchema = z.object({
    provider: z.enum(languageModelProviders).describe("The model provider (e.g., 'anthropic', 'openai')"),
    model: z.string().describe("The model ID"),
    displayName: z.string().optional().describe("Optional display name for the model"),
});

/**
 * Client safe subset of information about a language model.
 */
export type LanguageModelInfo = {
    provider: LanguageModelProvider,
    model: LanguageModel['model'],
    displayName?: LanguageModel['displayName'],
}

// Additional request body data that we send along to the chat API.
export const additionalChatRequestParamsSchema = z.object({
    languageModel: languageModelInfoSchema,
    selectedSearchScopes: z.array(searchScopeSchema),
});
export type AdditionalChatRequestParams = z.infer<typeof additionalChatRequestParamsSchema>;