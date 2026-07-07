import { beforeEach, describe, expect, test, vi } from "vitest";

// commandResolution is guarded with `import 'server-only'` and imports
// captureEvent from @/lib/posthog (a server-only module). Stub both so the
// suite can import the module under test in vitest's node environment.
const captureEvent = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({ default: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ captureEvent }));

import { ASK_COMMAND_SOURCE_SHARED_SKILL, ASK_COMMAND_SOURCE_PERSONAL_SKILL } from "@/features/chat/commands/types";
import type { FileSource, SBChatMessage } from "@/features/chat/types";
import { getFileSourcesFromText, getUserMessageModelText, materializeCommandMessageText, materializeCommandMessageTexts } from "./commandResolution";

beforeEach(() => {
    captureEvent.mockClear();
});

const createCommandMessage = (
    visibleText: string,
    expandedText?: string,
    overrides: Partial<{
        id: string;
        commandId: string;
        sourceId: string;
        sources: FileSource[];
    }> = {},
): SBChatMessage => ({
    id: overrides.id ?? "message-1",
    role: "user",
    parts: [
        {
            type: "text",
            text: `/translate ${visibleText}`,
        },
        {
            type: "data-command",
            data: {
                type: "command",
                commandId: overrides.commandId ?? "skill-1",
                sourceId: overrides.sourceId ?? ASK_COMMAND_SOURCE_PERSONAL_SKILL,
                slug: "translate",
                name: "Translate",
                ...(expandedText !== undefined ? { expandedText } : {}),
            },
        },
        ...(overrides.sources ?? []).map((source) => ({
            type: "data-source" as const,
            data: source,
        })),
    ],
});

describe("getFileSourcesFromText", () => {
    test("extracts and dedupes canonical file references", () => {
        expect(getFileSourcesFromText(
            "Read @file:{github.com/sourcebot-dev/sourcebot::packages/web/src/auth.ts} and @file:{github.com/sourcebot-dev/sourcebot::packages/web/src/auth.ts}.",
        )).toEqual([
            {
                type: "file",
                repo: "github.com/sourcebot-dev/sourcebot",
                path: "packages/web/src/auth.ts",
                name: "auth.ts",
                revision: "HEAD",
            },
        ]);
    });
});

describe("getUserMessageModelText", () => {
    test("uses persisted expanded text for the model", () => {
        expect(getUserMessageModelText(
            createCommandMessage("hello French", "Translate the most recent message into French."),
        )).toBe("Translate the most recent message into French.");
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
                    instructions: "Translate the most recent message into French.",
                }]),
            },
        };

        const message = await materializeCommandMessageText({
            message: createCommandMessage("hello French"),
            prisma: prisma as never,
            userId: "user-1",
            orgId: 7,
        });

        expect(message.parts).toContainEqual({
            type: "data-command",
            data: {
                type: "command",
                commandId: "skill-1",
                sourceId: ASK_COMMAND_SOURCE_PERSONAL_SKILL,
                slug: "translate",
                name: "Translate",
                expandedText: "Translate the most recent message into French.",
            },
        });
        expect(prisma.agentSkill.findMany).toHaveBeenCalledWith({
            where: {
                id: { in: ["skill-1"] },
                visibility: "PERSONAL",
                scopeId: "user-1",
                orgId: 7,
                createdById: "user-1",
                enabled: true,
            },
            select: {
                id: true,
                instructions: true,
                sourceRepoName: true,
            },
        });
    });

    test("uses the request source for manual invocation analytics", async () => {
        const prisma = {
            agentSkill: {
                findMany: vi.fn().mockResolvedValue([{
                    id: "skill-1",
                    instructions: "Translate the most recent message into French.",
                }]),
            },
        };

        await materializeCommandMessageText({
            message: createCommandMessage("hello French"),
            prisma: prisma as never,
            userId: "user-1",
            orgId: 7,
            requestSource: "sourcebot-mcp-server",
        });

        expect(captureEvent).toHaveBeenCalledWith("ask_skill_invoked", expect.objectContaining({
            activationMethod: "manual",
            skillIdHash: expect.any(String),
            source: "sourcebot-mcp-server",
            success: true,
            scope: "personal",
            isSynced: false,
        }));
    });

    test("adds file sources from materialized skill instructions", async () => {
        const prisma = {
            agentSkill: {
                findMany: vi.fn().mockResolvedValue([{
                    id: "skill-1",
                    instructions: "Review @file:{github.com/sourcebot-dev/sourcebot::packages/web/src/auth.ts}.",
                }]),
            },
        };

        const message = await materializeCommandMessageText({
            message: createCommandMessage("session"),
            prisma: prisma as never,
            userId: "user-1",
            orgId: 7,
        });

        expect(message.parts).toContainEqual({
            type: "data-source",
            data: {
                type: "file",
                repo: "github.com/sourcebot-dev/sourcebot",
                path: "packages/web/src/auth.ts",
                name: "auth.ts",
                revision: "HEAD",
            },
        });
        expect(getUserMessageModelText(message)).toBe("Review @file:{github.com/sourcebot-dev/sourcebot::packages/web/src/auth.ts}.");
    });

    test("does not duplicate file sources already present on the message", async () => {
        const existingSource = {
            type: "file",
            repo: "github.com/sourcebot-dev/sourcebot",
            path: "packages/web/src/auth.ts",
            name: "auth.ts",
            revision: "HEAD",
        } satisfies FileSource;
        const prisma = {
            agentSkill: {
                findMany: vi.fn().mockResolvedValue([{
                    id: "skill-1",
                    instructions: "Review @file:{github.com/sourcebot-dev/sourcebot::packages/web/src/auth.ts}.",
                }]),
            },
        };

        const message = await materializeCommandMessageText({
            message: createCommandMessage("", undefined, { sources: [existingSource] }),
            prisma: prisma as never,
            userId: "user-1",
            orgId: 7,
        });

        expect(message.parts.filter((part) => part.type === "data-source")).toEqual([
            {
                type: "data-source",
                data: existingSource,
            },
        ]);
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
            orgId: 7,
        });

        expect(message).toBe(originalMessage);
        expect(prisma.agentSkill.findMany).not.toHaveBeenCalled();
    });

    test("adds file sources from an existing expanded text snapshot without querying", async () => {
        const prisma = {
            agentSkill: {
                findMany: vi.fn(),
            },
        };

        const message = await materializeCommandMessageText({
            message: createCommandMessage(
                "session handling",
                "Review @file:{github.com/sourcebot-dev/sourcebot::packages/web/src/auth.ts}.",
            ),
            prisma: prisma as never,
            userId: "user-1",
            orgId: 7,
        });

        expect(prisma.agentSkill.findMany).not.toHaveBeenCalled();
        expect(message.parts).toContainEqual({
            type: "data-source",
            data: {
                type: "file",
                repo: "github.com/sourcebot-dev/sourcebot",
                path: "packages/web/src/auth.ts",
                name: "auth.ts",
                revision: "HEAD",
            },
        });
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
            orgId: 7,
        });

        expect(getUserMessageModelText(message)).toBe("/translate hello French");
    });

    test("materializes adopted shared skills within the active org", async () => {
        const prisma = {
            agentSkill: {
                findMany: vi.fn().mockResolvedValue([{
                    id: "shared-skill-1",
                    instructions: "Explain the most recent message using the team style guide.",
                }]),
            },
        };

        const message = await materializeCommandMessageText({
            message: createCommandMessage("decorators", undefined, {
                commandId: "shared-skill-1",
                sourceId: ASK_COMMAND_SOURCE_SHARED_SKILL,
            }),
            prisma: prisma as never,
            userId: "user-1",
            orgId: 7,
        });

        expect(prisma.agentSkill.findMany).toHaveBeenCalledWith({
            where: {
                id: { in: ["shared-skill-1"] },
                visibility: "SHARED",
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
                sourceRepoName: true,
            },
        });
        expect(getUserMessageModelText(message)).toBe("Explain the most recent message using the team style guide.");
    });

    test("falls back to literal text when a shared command is synced from an inaccessible repo", async () => {
        const prisma = {
            agentSkill: {
                findMany: vi.fn().mockResolvedValue([{
                    id: "shared-skill-1",
                    instructions: "Explain using the team style guide.",
                    sourceRepoName: "github.com/acme/secret",
                }]),
            },
            // The user-scoped repo lookup returns nothing → repo not visible.
            repo: {
                findMany: vi.fn().mockResolvedValue([]),
            },
        };

        const message = await materializeCommandMessageText({
            message: createCommandMessage("decorators", undefined, {
                commandId: "shared-skill-1",
                sourceId: ASK_COMMAND_SOURCE_SHARED_SKILL,
            }),
            prisma: prisma as never,
            userId: "user-1",
            orgId: 7,
        });

        // The synced skill is dropped by the repo-access gate, so the command keeps
        // its literal text instead of injecting the (inaccessible) instructions.
        expect(getUserMessageModelText(message)).toBe("/translate decorators");
        expect(prisma.repo.findMany).toHaveBeenCalledWith({
            where: { name: { in: ["github.com/acme/secret"] }, orgId: 7 },
            select: { name: true },
        });
    });

    test("does not materialize a shared skill that is neither adopted nor auto-enrolled", async () => {
        const prisma = {
            agentSkill: {
                findMany: vi.fn().mockResolvedValue([]),
            },
        };

        const message = await materializeCommandMessageText({
            message: createCommandMessage("decorators", undefined, {
                commandId: "shared-skill-1",
                sourceId: ASK_COMMAND_SOURCE_SHARED_SKILL,
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
            orgId: 7,
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
                        instructions: "Translate the most recent message into French.",
                    },
                    {
                        id: "skill-2",
                        instructions: "Generate a Python tutorial about decorators.",
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
            orgId: 7,
        });

        expect(prisma.agentSkill.findMany).toHaveBeenCalledTimes(1);
        expect(prisma.agentSkill.findMany).toHaveBeenCalledWith({
            where: {
                id: { in: ["skill-1", "skill-2"] },
                visibility: "PERSONAL",
                scopeId: "user-1",
                orgId: 7,
                createdById: "user-1",
                enabled: true,
            },
            select: {
                id: true,
                instructions: true,
                sourceRepoName: true,
            },
        });
        expect(messages.map(getUserMessageModelText)).toEqual([
            "Translate the most recent message into French.",
            "Generate a Python tutorial about decorators.",
        ]);
    });

    test("resolves personal and shared skills that share a command id without collision", async () => {
        const prisma = {
            agentSkill: {
                findMany: vi.fn().mockImplementation(async ({ where }) => {
                    if (where.visibility === "PERSONAL") {
                        return [{
                            id: "skill-1",
                            instructions: "Personal translation skill.",
                        }];
                    }

                    return [{
                        id: "skill-1",
                        instructions: "Shared translation skill.",
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
                    sourceId: ASK_COMMAND_SOURCE_SHARED_SKILL,
                }),
            ],
            prisma: prisma as never,
            userId: "user-1",
            orgId: 7,
        });

        expect(prisma.agentSkill.findMany).toHaveBeenCalledTimes(2);
        expect(messages.map(getUserMessageModelText)).toEqual([
            "Personal translation skill.",
            "Shared translation skill.",
        ]);
    });
});
