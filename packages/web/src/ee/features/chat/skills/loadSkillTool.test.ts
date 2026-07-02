import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Tool } from "ai";

const captureEvent = vi.fn();
vi.mock("@/lib/posthog", () => ({
    captureEvent: (...args: unknown[]) => captureEvent(...args),
}));

// loadSkillTool imports `createLogger` from @sourcebot/shared, whose real module
// reads server-side env vars at import time and trips the t3-env client guard
// under vitest's jsdom environment. Stub it so the module under test can load.
vi.mock("@sourcebot/shared", () => ({
    createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
    env: { NODE_ENV: "test" },
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

    test("loads the skill's raw instructions and reports success", async () => {
        const findFirst = vi.fn().mockResolvedValue({
            id: "p1",
            visibility: "PERSONAL",
            slug: "translate",
            name: "Translate",
            instructions: "Translate the file to the requested language.",
        });
        const prisma = { agentSkill: { findFirst } } as never;

        const tool = createLoadSkillTool({ prisma, userId: "user-1", orgId: 7 });
        const result = await execute(tool, { skill_id: "p1" });

        expect(result).toEqual({
            skill: { id: "p1", slug: "translate", name: "Translate" },
            instructions: "Translate the file to the requested language.",
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

    test("fails closed without leaking the error when the lookup throws", async () => {
        const findFirst = vi.fn().mockRejectedValue(new Error("connection pool exhausted"));
        const prisma = { agentSkill: { findFirst } } as never;

        const tool = createLoadSkillTool({ prisma, userId: "user-1", orgId: 7 });
        const result = await execute(tool, { skill_id: "p1" });

        // The transient throw must take the fail-closed path, not propagate.
        expect(result).toHaveProperty("error");
        expect(result).not.toHaveProperty("instructions");
        // The raw error text must never reach the model.
        expect(JSON.stringify(result)).not.toContain("connection pool exhausted");
        expect(captureEvent).toHaveBeenCalledWith("ask_skill_invoked", expect.objectContaining({
            activationMethod: "auto",
            skillId: "p1",
            success: false,
        }));
    });
});
