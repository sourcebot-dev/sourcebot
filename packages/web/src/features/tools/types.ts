import { z } from "zod";

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
    description: string;
    inputSchema: z.ZodObject<TShape>;
    isReadOnly: boolean;
    isIdempotent: boolean;
    execute: (input: z.infer<z.ZodObject<TShape>>, context: ToolContext) => Promise<ToolResult<TMetadata>>;
}

export interface ToolResult<TMetadata = Record<string, unknown>> {
    output: string;
    metadata: TMetadata;
}
