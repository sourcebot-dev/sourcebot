import { CreateUIMessage, InferUITool, UIMessage, UIMessagePart } from "ai";
import { BaseEditor, Descendant } from "slate";
import { HistoryEditor } from "slate-history";
import { ReactEditor, RenderElementProps } from "slate-react";
import { z } from "zod";
import { LanguageModel } from "@sourcebot/schemas/v3/index.type";
// Type-only import: the chat message tool types are derived from the shape of the
// EE agent's tools, but no runtime dependency on ee/ is introduced (erased at build).
import type { createTools } from "@/ee/features/chat/tools";
export { sourceSchema } from "@/features/tools/types";
export type { FileSource, Source } from "@/features/tools/types";
import type { Source } from "@/features/tools/types";
import type { CommandInvocationData, CommandMentionData } from "./commands/types";

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
    // Portion of input tokens served from / written to the prompt cache.
    totalCacheReadTokens: z.number().optional(),
    totalCacheWriteTokens: z.number().optional(),
    totalResponseTimeMs: z.number().optional(),
    contextWindow: z.number().optional(),
    feedback: z.array(z.object({
        type: z.enum(['like', 'dislike']),
        timestamp: z.string(), // ISO date string
        userId: z.string().optional(),
    })).optional(),
    selectedSearchScopes: z.array(searchScopeSchema).optional(),
    disabledMcpServerIds: z.array(z.string()).optional(),
    traceId: z.string().optional(),
    // Token usage of each agent step in this message's turn, in step order
    // across all approval-continuation phases. The step array position is the
    // step's identity: the UI joins these entries to its steps by array
    // index, so the array must stay 1:1 with the turn's steps.
    stepTokenUsage: z.array(z.object({
        // Provider-reported (billed, not estimated) usage of this step.
        inputTokens: z.number().optional(),
        outputTokens: z.number().optional(),
        cacheReadTokens: z.number().optional(),
        // Tool calls that ran in this step, each with the estimated
        // input-token footprint its output imposes when fed back to the model
        // on the next step. These are local estimates — never to be confused
        // with the authoritative provider-reported fields.
        tools: z.array(z.object({
            toolCallId: z.string(),
            toolName: z.string(),
            estimatedOutputTokens: z.number(),
        })),
    })).optional(),
});

export type SBChatMessageMetadata = z.infer<typeof sbChatMessageMetadataSchema>;

export type StepTokenUsageEntry = NonNullable<SBChatMessageMetadata['stepTokenUsage']>[number];
export type ToolTokenUsageEntry = StepTokenUsageEntry['tools'][number];

export type SBChatMessageToolTypes = {
    [K in keyof ReturnType<typeof createTools>]: InferUITool<ReturnType<typeof createTools>[K]>;
} & {
    tool_request_activation: {
        input: { tool_to_activate_name: string };
        output: { results: Array<{ name: string; description: string }> };
    };
    // load_skill is constructed in the EE agent (createLoadSkillTool), not in
    // createTools, so its UI part shape is declared here by hand — mirror of the
    // execute() return in ee/features/chat/tools/loadSkillTool.ts.
    load_skill: {
        input: { skill_id: string };
        output:
            | { skill: { id: string; slug: string; name: string }; instructions: string }
            | { error: string };
    };
};

// A user-provided file attachment. The `text` variant carries the file's
// extracted text inline (used for text/code/structured files). The `blob`
// variant references stored bytes by id (used for binary attachments like
// images that cannot be inlined as text); the bytes live in the StorageBackend
// and never travel in the `messages` JSON.
export const textAttachmentSchema = z.object({
    kind: z.literal('text'),
    // Stable, message-persisted handle for the attachment. Carried through from
    // the pending attachment's client id so later features (citing/referencing
    // attachment content) have a durable handle on every persisted attachment.
    id: z.string(),
    filename: z.string(),
    mediaType: z.string(),
    sizeBytes: z.number(),
    text: z.string(),
});
export type TextAttachment = z.infer<typeof textAttachmentSchema>;

export const blobAttachmentSchema = z.object({
    kind: z.literal('blob'),
    attachmentId: z.string(),
    filename: z.string(),
    mediaType: z.string(),
    sizeBytes: z.number(),
});
export type BlobAttachment = z.infer<typeof blobAttachmentSchema>;

export const attachmentDataSchema = z.discriminatedUnion('kind', [
    textAttachmentSchema,
    blobAttachmentSchema,
]);
export type AttachmentData = z.infer<typeof attachmentDataSchema>;

export type SBChatMessageDataParts = {
    // The `source` data type allows us to know what sources the LLM saw
    // during retrieval.
    "source": Source,
    // The `mcp-server` data type carries favicon metadata for connected MCP servers,
    // keyed by sanitized server name (e.g. "linear").
    "mcp-server": { sanitizedName: string; faviconUrl: string },
    // The `mcp-tool` data type maps the provider-safe model tool name back to
    // the raw MCP tool name for display.
    "mcp-tool": { modelToolName: string; rawToolName: string },
    // The `mcp-failed-server` data type surfaces MCP servers that failed to load their tools.
    "mcp-failed-server": { serverName: string },
    // A user-provided file attachment included with the message.
    "attachment": AttachmentData,
    // The `command` data type preserves the slash command identity so the server
    // can resolve and expand the command's instructions securely.
    "command": CommandInvocationData,
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

export const fileMentionDataSchema = z.object({
    type: z.literal('file'),
    repo: z.string(),
    path: z.string(),
    name: z.string(),
    language: z.string(),
    revision: z.string(),
});

export type FileMentionData = z.infer<typeof fileMentionDataSchema>;

export const isFileMentionData = (value: unknown): value is FileMentionData =>
    fileMentionDataSchema.safeParse(value).success;

export type MentionData = FileMentionData | CommandMentionData;

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
    disabledMcpServerIds: string[];
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

export const inputModalities = ['text', 'image', 'audio', 'video'] as const;
export type InputModality = typeof inputModalities[number];

export const documentTypes = ['pdf'] as const;
export type DocumentType = typeof documentTypes[number];

export const languageModelInfoSchema = z.object({
    provider: z.enum(languageModelProviders).describe("The model provider (e.g., 'anthropic', 'openai')"),
    model: z.string().describe("The model ID"),
    displayName: z.string().optional().describe("Optional display name for the model"),
    inputModalities: z.array(z.enum(inputModalities)).default(['text']).describe("The input modalities the model can accept (images, audio, video, text). Single-medium attachments are gated by these. Defaults to text-only."),
    supportedDocumentTypes: z.array(z.enum(documentTypes)).default([]).describe("Rich compound document formats (e.g. PDF) the model can ingest natively, distinct from single-medium attachments gated by inputModalities. Defaults to none."),
});

/**
 * Client safe subset of information about a language model.
 */
export type LanguageModelInfo = {
    provider: LanguageModelProvider,
    model: LanguageModel['model'],
    displayName?: LanguageModel['displayName'],
    inputModalities: InputModality[],
    supportedDocumentTypes: DocumentType[],
}

// Additional request body data that we send along to the chat API.
export const additionalChatRequestParamsSchema = z.object({
    languageModel: languageModelInfoSchema,
    selectedSearchScopes: z.array(searchScopeSchema),
    disabledMcpServerIds: z.array(z.string()).default([]),
});
export type AdditionalChatRequestParams = z.infer<typeof additionalChatRequestParamsSchema>;
