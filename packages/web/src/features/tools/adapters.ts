import { tool } from "ai";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolDefinition } from "./types";

export function toVercelAITool<TName extends string, TShape extends z.ZodRawShape, TMetadata>(
    def: ToolDefinition<TName, TShape, TMetadata>,
) {
    return tool({
        description: def.description,
        inputSchema: def.inputSchema,
        execute: def.execute,
        toModelOutput: ({ output }) => ({
            type: "content",
            value: [{ type: "text", text: output.output }],
        }),
    });
}

export function registerMcpTool<TName extends string, TShape extends z.ZodRawShape, TMetadata>(
    server: McpServer,
    def: ToolDefinition<TName, TShape, TMetadata>,
) {
    // Widening .shape to z.ZodRawShape (its base constraint) gives TypeScript a
    // concrete InputArgs so it can fully resolve BaseToolCallback's conditional
    // type. def.inputSchema.parse() recovers the correctly typed value inside.
    server.registerTool(
        def.name,
        { description: def.description, inputSchema: def.inputSchema.shape as z.ZodRawShape },
        async (input) => {
            const parsed = def.inputSchema.parse(input);
            const result = await def.execute(parsed);
            return { content: [{ type: "text" as const, text: result.output }] };
        },
    );
}
