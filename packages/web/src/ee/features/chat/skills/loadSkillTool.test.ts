import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Tool } from "ai";

const captureEvent = vi.fn();
vi.mock("@/lib/posthog", () => ({
    captureEvent: (...args: unknown[]) => captureEvent(...args),
}));

import { createLoadSkillTool } from "./loadSkillTool";

// The AI SDK passes (input, options) to execute; the tool ignores options.
const execute = (tool: Tool, input: unknown) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (tool.execute as any)(input, { toolCallId: "call-1", messages: [] });

describe("createLoadSkillTool", () => {
    beforeEach(() => {
        captureEvent.mockClear();
    });

    test("loads instructions with argument substitution and reports success", async () => {
        const findFirst = vi.fn().mockResolvedValue({
            id: "p1",
            visibility: "PERSONAL",
            slug: "translate",
            name: "Translate",
            instructions: "Translate the file to $0.",
            argumentNames: [],
        });
        const prisma = { agentSkill: { findFirst } } as never;

        const tool = createLoadSkillTool({ prisma, userId: "user-1", orgId: 7 });
        const result = await execute(tool, { skill_id: "p1", arguments: "french" });

        expect(result).toEqual({
            skill: { id: "p1", slug: "translate", name: "Translate" },
            instructions: "Translate the file to french.",
        });
        expect(captureEvent).toHaveBeenCalledWith("ask_skill_invoked", expect.objectContaining({
            activationMethod: "auto",
            skillId: "p1",
            slug: "translate",
            success: true,
        }));
    });

    test("fails closed and surfaces a non-leaking error when the skill is unavailable", async () => {
        const findFirst = vi.fn().mockResolvedValue(null);
        const prisma = { agentSkill: { findFirst } } as never;

        const tool = createLoadSkillTool({ prisma, userId: "user-1", orgId: 7 });
        const result = await execute(tool, { skill_id: "not-visible" });

        expect(result).toHaveProperty("error");
        expect(result).not.toHaveProperty("instructions");
        expect(captureEvent).toHaveBeenCalledWith("ask_skill_invoked", expect.objectContaining({
            activationMethod: "auto",
            skillId: "not-visible",
            success: false,
        }));
    });
});
