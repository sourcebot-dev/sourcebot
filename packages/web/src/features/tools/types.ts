import { z } from "zod";

const fileSourceSchema = z.object({
    type: z.literal('file'),
    repo: z.string(),
    path: z.string(),
    name: z.string(),
    ref: z.string(),
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
    execute: (input: z.infer<z.ZodObject<TShape>>, context: ToolContext) => Promise<ToolResult<TMetadata>>;
}

export interface ToolResult<TMetadata = Record<string, unknown>> {
    output: string;
    metadata: TMetadata;
    sources?: Source[];
}
