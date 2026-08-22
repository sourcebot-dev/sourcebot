import { z } from "zod";

const fileSourceSchema = z.object({
    type: z.literal('file'),
    repo: z.string(),
    path: z.string(),
    name: z.string(),
    revision: z.string(),
    range: z.object({
        startLine: z.number().int().positive(),
        endLine: z.number().int().positive(),
    }).refine(({ startLine, endLine }) => endLine >= startLine).optional(),
});
export type FileSource = z.infer<typeof fileSourceSchema>;

export const sourceSchema = z.discriminatedUnion('type', [
    fileSourceSchema,
]);
export type Source = z.infer<typeof sourceSchema>;

export interface ToolContext {
    source?: string;
    selectedRepos?: string[];
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
    // Whether the tool can destroy or overwrite existing data. Emitted as the
    // MCP destructiveHint annotation (which MCP clients default to true for
    // non-read-only tools, so additive writes should set this to false).
    isDestructive?: boolean;
    execute: (input: z.infer<z.ZodObject<TShape>>, context: ToolContext) => Promise<ToolResult<TMetadata>>;
}

export interface ToolResult<TMetadata = Record<string, unknown>> {
    output: string;
    metadata: TMetadata;
    sources?: Source[];
}
