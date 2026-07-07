import { describe, expect, test, vi } from "vitest";
import { ASK_COMMAND_SOURCE_PERSONAL_SKILL } from "@/features/chat/commands/types";
import type { SBChatMessage } from "@/features/chat/types";

vi.mock("server-only", () => ({ default: vi.fn() }));

import { getAskSkillTurnCompletedAnalytics } from "./skillAnalytics.server";

const userMessageWithCommand = (commandId: string): SBChatMessage => ({
    id: "user-message",
    role: "user",
    parts: [
        {
            type: "text",
            text: "/review this change",
        },
        {
            type: "data-command",
            data: {
                type: "command",
                commandId,
                sourceId: ASK_COMMAND_SOURCE_PERSONAL_SKILL,
                slug: "review",
                name: "Review",
            },
        },
    ],
});

const assistantMessage = (parts: SBChatMessage["parts"]): SBChatMessage => ({
    id: "assistant-message",
    role: "assistant",
    metadata: {
        traceId: "trace-1",
        totalResponseTimeMs: 123,
    },
    parts,
});

describe("getAskSkillTurnCompletedAnalytics", () => {
    test("returns undefined when skills are unavailable and unused", () => {
        expect(getAskSkillTurnCompletedAnalytics({
            messages: [assistantMessage([{ type: "text", text: "Done." }])],
            availability: { availableSkillCount: 0 },
        })).toBeUndefined();
    });

    test("aggregates manual and auto skill activity for the completed turn", () => {
        const analytics = getAskSkillTurnCompletedAnalytics({
            messages: [
                userMessageWithCommand("skill-1"),
                assistantMessage([
                    {
                        type: "tool-load_skill",
                        toolCallId: "tool-call-1",
                        state: "output-available",
                        input: { skill_id: "skill-2" },
                        output: {
                            skill: { id: "skill-2", slug: "audit", name: "Audit" },
                            instructions: "Audit the change.",
                        },
                    },
                    {
                        type: "tool-load_skill",
                        toolCallId: "tool-call-2",
                        state: "output-available",
                        input: { skill_id: "missing-skill" },
                        output: { error: "That skill is not available." },
                    },
                    { type: "text", text: "Done." },
                ] as SBChatMessage["parts"]),
            ],
            availability: { availableSkillCount: 3 },
        });

        expect(analytics).toEqual({
            traceId: "trace-1",
            availableSkillCount: 3,
            manualInvocationCount: 1,
            autoInvocationCount: 2,
            successfulInvocationCount: 2,
            failedInvocationCount: 1,
            uniqueSkillCount: 2,
            durationMs: 123,
        });
    });
});
