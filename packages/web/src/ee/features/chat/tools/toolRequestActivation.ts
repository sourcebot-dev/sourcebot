import { tool, type Tool } from "ai";
import { z } from "zod";
import _dedent from "dedent";
import { searchMcpTools } from "../mcp/mcpToolRegistry";
import type { McpToolRegistryEntry } from "../mcp/mcpToolRegistry";

const dedent = _dedent.withOptions({ alignValues: true });

export const TOOL_REQUEST_ACTIVATION_TOOL_NAME = "tool_request_activation";

export const createToolRequestActivationTool = (
    mcpRegistry: McpToolRegistryEntry[],
): Tool =>
    tool({
        description: dedent`
        Activate an MCP tool by name so it becomes callable on your next step.
        You MUST pass an exact tool name from the tool registry in the system prompt.
        Do NOT pass natural language descriptions or sentences.
        If you need multiple tools, call this once per tool.

        Examples:
          CORRECT: tool_to_activate_name="mcp_linear__save_comment"
          CORRECT: tool_to_activate_name="mcp_linear__create_attachment"
          INCORRECT: tool_to_activate_name="create a linear issue and update status"
          INCORRECT: tool_to_activate_name="find tools for commenting on issues"
        `,
        inputSchema: z.object({
            tool_to_activate_name: z.string().describe('Exact tool name from the registry, e.g. "mcp_linear__save_comment"'),
        }),
        execute: async ({ tool_to_activate_name }) => {
            const results = searchMcpTools(tool_to_activate_name, mcpRegistry);
            return {
                results: results.map(e => ({ name: e.name, description: e.description })),
            };
        },
    });
