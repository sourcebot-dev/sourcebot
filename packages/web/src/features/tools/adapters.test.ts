import { describe, expect, test, vi } from "vitest";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDefinition } from "./types";

vi.mock("@/lib/posthog", () => ({
    captureEvent: vi.fn(),
}));

const { registerMcpTool, toVercelAITool } = await import("./adapters");

const emptyShape = {};

const makeDefinition = (overrides: Partial<ToolDefinition<string, typeof emptyShape>>): ToolDefinition<string, typeof emptyShape> => ({
    name: "fake_tool",
    title: "Fake tool",
    description: "A fake tool.",
    inputSchema: z.object(emptyShape),
    isReadOnly: true,
    isIdempotent: true,
    execute: vi.fn(async () => ({ output: "", metadata: {} })),
    ...overrides,
});

describe("toVercelAITool", () => {
    test("requires approval for non-read-only tools", () => {
        const tool = toVercelAITool(makeDefinition({ isReadOnly: false }), {});
        expect(tool.needsApproval).toBe(true);
    });

    test("does not require approval for read-only tools", () => {
        const tool = toVercelAITool(makeDefinition({ isReadOnly: true }), {});
        expect(tool.needsApproval).toBeFalsy();
    });
});

describe("registerMcpTool", () => {
    const registerOn = (def: ToolDefinition<string, typeof emptyShape>) => {
        const registerTool = vi.fn();
        registerMcpTool({ registerTool } as unknown as McpServer, def, {});
        return registerTool.mock.calls[0][1].annotations as Record<string, unknown>;
    };

    test("emits destructiveHint: false for an additive write", () => {
        const annotations = registerOn(makeDefinition({ isReadOnly: false, isIdempotent: false, isDestructive: false }));
        expect(annotations).toEqual({
            readOnlyHint: false,
            idempotentHint: false,
            destructiveHint: false,
        });
    });

    test("emits destructiveHint: true for a destructive write", () => {
        const annotations = registerOn(makeDefinition({ isReadOnly: false, isDestructive: true }));
        expect(annotations).toMatchObject({ destructiveHint: true });
    });

    test("omits destructiveHint when isDestructive is undefined", () => {
        const annotations = registerOn(makeDefinition({}));
        expect(annotations).toEqual({
            readOnlyHint: true,
            idempotentHint: true,
        });
    });
});
