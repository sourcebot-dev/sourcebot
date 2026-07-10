import { describe, expect, test } from "vitest";
import type { Tool } from "ai";
import { createToolRequestActivationTool } from "./toolRequestActivation";

const execute = (tool: Tool, input: unknown) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (tool.execute as any)(input, { toolCallId: "call-1", messages: [] });

describe("createToolRequestActivationTool", () => {
    test("returns matching MCP tools without exposing server-only registry fields", async () => {
        const tool = createToolRequestActivationTool([
            {
                name: "mcp_linear__save_comment",
                description: "Save a comment on a Linear issue",
                serverName: "linear",
            },
            {
                name: "mcp_github__list_repos",
                description: "List GitHub repositories",
                serverName: "github",
            },
        ]);

        const result = await execute(tool, {
            tool_to_activate_name: "mcp_linear__save_comment",
        });

        expect(result).toEqual({
            results: [
                {
                    name: "mcp_linear__save_comment",
                    description: "Save a comment on a Linear issue",
                },
            ],
        });
    });
});
