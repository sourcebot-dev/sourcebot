import { beforeEach, describe, expect, test, vi } from "vitest";
import { ASK_COMMAND_SOURCE_PERSONAL_SKILL } from "@/features/chat/commands/types";
import type { SBChatMessage } from "@/features/chat/types";
import { hasEntitlement } from "@/lib/entitlements";

vi.mock("server-only", () => ({ default: vi.fn() }));
vi.mock("@/lib/entitlements", () => ({ hasEntitlement: vi.fn() }));

import {
    getAskSkillAvailabilityAnalytics,
    getAskSkillTurnCompletedAnalytics,
} from "./skillAnalytics.server";

type AskSkillAvailabilityPrisma = Parameters<typeof getAskSkillAvailabilityAnalytics>[0]["prisma"];

const hasEntitlementMock = vi.mocked(hasEntitlement);

beforeEach(() => {
    vi.clearAllMocks();
    hasEntitlementMock.mockResolvedValue(true);
});

const userMessageWithCommand = (
    commandId: string,
    resolutionStatus: "success" | "failure" = "success",
): SBChatMessage => ({
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
                resolutionStatus,
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

describe("getAskSkillAvailabilityAnalytics", () => {
    test("counts accessible skills without building command definitions", async () => {
        const prisma = {
            agentSkill: {
                findMany: vi.fn()
                    .mockResolvedValueOnce([
                        { sourceRepoName: null },
                        { sourceRepoName: "github.com/acme/widgets" },
                        { sourceRepoName: "github.com/acme/secret" },
                    ])
                    .mockResolvedValueOnce([
                        { sourceRepoName: null },
                        { sourceRepoName: "github.com/acme/widgets" },
                    ]),
            },
            repo: {
                findMany: vi.fn().mockResolvedValue([{ name: "github.com/acme/widgets" }]),
            },
        };

        const analytics = await getAskSkillAvailabilityAnalytics({
            prisma: prisma as unknown as AskSkillAvailabilityPrisma,
            userId: "user-1",
            orgId: 1,
        });

        expect(analytics).toEqual({ availableSkillCount: 4 });
        expect(prisma.agentSkill.findMany).toHaveBeenCalledTimes(2);
        expect(prisma.agentSkill.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
            select: { sourceRepoName: true },
        }));
        expect(prisma.agentSkill.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
            select: { sourceRepoName: true },
        }));
        expect(prisma.repo.findMany).toHaveBeenCalledWith({
            where: {
                name: { in: ["github.com/acme/widgets", "github.com/acme/secret"] },
                orgId: 1,
            },
            select: { name: true },
        });
    });
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

    test("counts a failed manual skill as a failed invocation", () => {
        const analytics = getAskSkillTurnCompletedAnalytics({
            messages: [
                userMessageWithCommand("missing-skill", "failure"),
                assistantMessage([{ type: "text", text: "I could not load that skill." }]),
            ],
            availability: { availableSkillCount: 3 },
        });

        expect(analytics).toEqual({
            traceId: "trace-1",
            availableSkillCount: 3,
            manualInvocationCount: 1,
            autoInvocationCount: 0,
            successfulInvocationCount: 0,
            failedInvocationCount: 1,
            uniqueSkillCount: 1,
            durationMs: 123,
        });
    });
});
