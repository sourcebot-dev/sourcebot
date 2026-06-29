import { z } from "zod";

const fileSourceSchema = z.object({
    type: z.literal('file'),
    repo: z.string(),
    path: z.string(),
    name: z.string(),
    revision: z.string(),
});
export type FileSource = z.infer<typeof fileSourceSchema>;

// A user-provided attachment the agent retrieved. `attachmentId` is the stable
// handle the agent cites and the panel resolves against; it never carries the
// content, only addresses it.
const attachmentSourceSchema = z.object({
    type: z.literal('attachment'),
    attachmentId: z.string(),
    name: z.string(),
    mediaType: z.string(),
});
export type AttachmentSource = z.infer<typeof attachmentSourceSchema>;

export const sourceSchema = z.discriminatedUnion('type', [
    fileSourceSchema,
    attachmentSourceSchema,
]);
export type Source = z.infer<typeof sourceSchema>;

export interface ToolContext {
    source?: string;
    selectedRepos?: string[];
    // Resolves an attachment's content by its stable id. This is the inline-vs-blob
    // seam: today it reads inlined text from the in-memory turn registry, but a
    // future blob/document backend can resolve the same id from storage without
    // touching tool callers.
    getAttachment?: (id: string) => { filename: string; mediaType: string; text: string } | undefined;
}

export interface ToolDefinition<
    TName extends string,
    TShape extends z.ZodRawShape,
    TMetadata = Record<string, unknown>,
> {
    name: TName;
    title: string;
    description: string;
    inputSchema: z.ZodObject<TShape>;
    isReadOnly: boolean;
    isIdempotent: boolean;
    execute: (input: z.infer<z.ZodObject<TShape>>, context: ToolContext) => Promise<ToolResult<TMetadata>>;
}

export interface ToolResult<TMetadata = Record<string, unknown>> {
    output: string;
    metadata: TMetadata;
    sources?: Source[];
}
