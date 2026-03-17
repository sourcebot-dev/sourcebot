import { z } from "zod";

// TShape is constrained to ZodRawShape (i.e. Record<string, ZodType>) so that
// both adapters receive a statically-known object schema. Tool inputs are
// always key-value objects, so this constraint is semantically correct and also
// lets the MCP adapter pass `.shape` (a ZodRawShapeCompat) to registerTool,
// which avoids an unresolvable conditional type in BaseToolCallback.
export interface ToolDefinition<
    TName extends string,
    TShape extends z.ZodRawShape,
    TMetadata = Record<string, unknown>,
> {
    name: TName;
    description: string;
    inputSchema: z.ZodObject<TShape>;
    execute: (input: z.infer<z.ZodObject<TShape>>) => Promise<ToolResult<TMetadata>>;
}

export interface ToolResult<TMetadata = Record<string, unknown>> {
    output: string;
    metadata: TMetadata;
}
