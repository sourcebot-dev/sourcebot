import { describe, expect, test, vi } from "vitest";
import { ASK_COMMAND_SOURCE_ORG_SKILL, ASK_COMMAND_SOURCE_PERSONAL_SKILL } from "@/features/chat/commands/types";
import type { SBChatMessage } from "@/features/chat/types";
import { getUserMessageModelText, materializeCommandMessageText, materializeCommandMessageTexts } from "./commandResolution";

const createCommandMessage = (
    rawArguments: string,
    expandedText?: string,
    overrides: Partial<{
        id: string;
        commandId: string;
        sourceId: string;
    }> = {},
): SBChatMessage => ({
    id: overrides.id ?? "message-1",
    role: "user",
    parts: [
        {
            type: "text",
            text: `/translate ${rawArguments}`,
        },
        {
            type: "data-command",
            data: {
                type: "command",
                commandId: overrides.commandId ?? "skill-1",
                sourceId: overrides.sourceId ?? ASK_COMMAND_SOURCE_PERSONAL_SKILL,
                slug: "translate",
                name: "Translate",
                rawArguments,
                ...(expandedText !== undefined ? { expandedText } : {}),
            },
        },
    ],
});

describe("getUserMessageModelText", () => {
    test("uses persisted expanded text for the model", () => {
        expect(getUserMessageModelText(
            createCommandMessage("hello French", 'Translate the word "hello" into French.'),
        )).toBe('Translate the word "hello" into French.');
    });

    test("falls back to visible text when no expanded text is materialized", () => {
        expect(getUserMessageModelText(createCommandMessage("hello French"))).toBe("/translate hello French");
    });
});

describe("materializeCommandMessageText", () => {
    test("materializes expanded text into the command part", async () => {
        const prisma = {
            agentSkill: {
                findMany: vi.fn().mockResolvedValue([{
                    id: "skill-1",
                    instructions: 'Translate the word "$0" into $1.',
                    argumentNames: [],
                }]),
            },
        };

        const message = await materializeCommandMessageText({
            message: createCommandMessage("hello French"),
            prisma: prisma as never,
            userId: "user-1",
        });

        expect(message.parts).toContainEqual({
            type: "data-command",
            data: {
                type: "command",
                commandId: "skill-1",
                sourceId: ASK_COMMAND_SOURCE_PERSONAL_SKILL,
                slug: "translate",
                name: "Translate",
                rawArguments: "hello French",
                expandedText: 'Translate the word "hello" into French.',
            },
        });
        expect(prisma.agentSkill.findMany).toHaveBeenCalledWith({
            where: {
                id: { in: ["skill-1"] },
                visibility: "PERSONAL",
                scopeId: "user-1",
                createdById: "user-1",
                orgId: null,
                enabled: true,
            },
            select: {
                id: true,
                instructions: true,
                argumentNames: true,
            },
        });
    });

    test("materializes named arguments", async () => {
        const prisma = {
            agentSkill: {
                findMany: vi.fn().mockResolvedValue([{
                    id: "skill-1",
                    instructions: "Generate a beginner-friendly $language tutorial about $topic.",
                    argumentNames: ["language", "topic"],
                }]),
            },
        };

        const message = await materializeCommandMessageText({
            message: createCommandMessage("Python decorators"),
            prisma: prisma as never,
            userId: "user-1",
        });

        expect(getUserMessageModelText(message)).toBe("Generate a beginner-friendly Python tutorial about decorators.");
    });

    test("does not rematerialize an existing expanded text snapshot", async () => {
        const prisma = {
            agentSkill: {
                findMany: vi.fn(),
            },
        };
        const originalMessage = createCommandMessage("hello French", "Saved expansion.");

        const message = await materializeCommandMessageText({
            message: originalMessage,
            prisma: prisma as never,
            userId: "user-1",
        });

        expect(message).toBe(originalMessage);
        expect(prisma.agentSkill.findMany).not.toHaveBeenCalled();
    });

    test("falls back to visible text when the skill is not accessible", async () => {
        const prisma = {
            agentSkill: {
                findMany: vi.fn().mockResolvedValue([]),
            },
        };

        const message = await materializeCommandMessageText({
            message: createCommandMessage("hello French"),
            prisma: prisma as never,
            userId: "user-1",
        });

        expect(getUserMessageModelText(message)).toBe("/translate hello French");
    });

    test("materializes adopted org skills within the active org", async () => {
        const prisma = {
            agentSkill: {
                findMany: vi.fn().mockResolvedValue([{
                    id: "org-skill-1",
                    instructions: "Explain $0 using the team style guide.",
                    argumentNames: [],
                }]),
            },
        };

        const message = await materializeCommandMessageText({
            message: createCommandMessage("decorators", undefined, {
                commandId: "org-skill-1",
                sourceId: ASK_COMMAND_SOURCE_ORG_SKILL,
            }),
            prisma: prisma as never,
            userId: "user-1",
            orgId: 7,
        });

        expect(prisma.agentSkill.findMany).toHaveBeenCalledWith({
            where: {
                id: { in: ["org-skill-1"] },
                visibility: "ORG",
                scopeId: "7",
                orgId: 7,
                enabled: true,
                AND: [
                    {
                        OR: [
                            { autoEnrolled: true },
                            {
                                adoptions: {
                                    some: {
                                        userId: "user-1",
                                        orgId: 7,
                                        removedAt: null,
                                    },
                                },
                            },
                        ],
                    },
                    {
                        NOT: {
                            adoptions: {
                                some: {
                                    userId: "user-1",
                                    orgId: 7,
                                    removedAt: {
                                        not: null,
                                    },
                                },
                            },
                        },
                    },
                ],
            },
            select: {
                id: true,
                instructions: true,
                argumentNames: true,
            },
        });
        expect(getUserMessageModelText(message)).toBe("Explain decorators using the team style guide.");
    });

    test("does not materialize an org skill that is neither adopted nor auto-enrolled", async () => {
        const prisma = {
            agentSkill: {
                findMany: vi.fn().mockResolvedValue([]),
            },
        };

        const message = await materializeCommandMessageText({
            message: createCommandMessage("decorators", undefined, {
                commandId: "org-skill-1",
                sourceId: ASK_COMMAND_SOURCE_ORG_SKILL,
            }),
            prisma: prisma as never,
            userId: "user-1",
            orgId: 7,
        });

        expect(getUserMessageModelText(message)).toBe("/translate decorators");
    });

    test("does not query and falls back to visible text without a user", async () => {
        const prisma = {
            agentSkill: {
                findMany: vi.fn(),
            },
        };

        const message = await materializeCommandMessageText({
            message: createCommandMessage("hello French"),
            prisma: prisma as never,
            userId: undefined,
        });

        expect(prisma.agentSkill.findMany).not.toHaveBeenCalled();
        expect(getUserMessageModelText(message)).toBe("/translate hello French");
    });
});

describe("materializeCommandMessageTexts", () => {
    test("batch-resolves unresolved command messages with one query", async () => {
        const prisma = {
            agentSkill: {
                findMany: vi.fn().mockResolvedValue([
                    {
                        id: "skill-1",
                        instructions: 'Translate "$0" into $1.',
                        argumentNames: [],
                    },
                    {
                        id: "skill-2",
                        instructions: "Generate a $language tutorial about $topic.",
                        argumentNames: ["language", "topic"],
                    },
                ]),
            },
        };

        const messages = await materializeCommandMessageTexts({
            messages: [
                createCommandMessage("hello French", undefined, { id: "message-1", commandId: "skill-1" }),
                createCommandMessage("Python decorators", undefined, { id: "message-2", commandId: "skill-2" }),
            ],
            prisma: prisma as never,
            userId: "user-1",
        });

        expect(prisma.agentSkill.findMany).toHaveBeenCalledTimes(1);
        expect(prisma.agentSkill.findMany).toHaveBeenCalledWith({
            where: {
                id: { in: ["skill-1", "skill-2"] },
                visibility: "PERSONAL",
                scopeId: "user-1",
                createdById: "user-1",
                orgId: null,
                enabled: true,
            },
            select: {
                id: true,
                instructions: true,
                argumentNames: true,
            },
        });
        expect(messages.map(getUserMessageModelText)).toEqual([
            'Translate "hello" into French.',
            "Generate a Python tutorial about decorators.",
        ]);
    });

    test("resolves personal and org skills that share a command id without collision", async () => {
        const prisma = {
            agentSkill: {
                findMany: vi.fn().mockImplementation(async ({ where }) => {
                    if (where.visibility === "PERSONAL") {
                        return [{
                            id: "skill-1",
                            instructions: "Personal translation of $0.",
                            argumentNames: [],
                        }];
                    }

                    return [{
                        id: "skill-1",
                        instructions: "Workspace translation of $0.",
                        argumentNames: [],
                    }];
                }),
            },
        };

        const messages = await materializeCommandMessageTexts({
            messages: [
                createCommandMessage("hello", undefined, {
                    id: "message-1",
                    commandId: "skill-1",
                    sourceId: ASK_COMMAND_SOURCE_PERSONAL_SKILL,
                }),
                createCommandMessage("hello", undefined, {
                    id: "message-2",
                    commandId: "skill-1",
                    sourceId: ASK_COMMAND_SOURCE_ORG_SKILL,
                }),
            ],
            prisma: prisma as never,
            userId: "user-1",
            orgId: 7,
        });

        expect(prisma.agentSkill.findMany).toHaveBeenCalledTimes(2);
        expect(messages.map(getUserMessageModelText)).toEqual([
            "Personal translation of hello.",
            "Workspace translation of hello.",
        ]);
    });
});
