import { beforeEach, describe, expect, test, vi } from "vitest";
import { ErrorCode } from "@/lib/errorCodes";
import { StatusCodes } from "http-status-codes";

const mocks = vi.hoisted(() => ({
    authContext: undefined as unknown,
    checkAskEntitlement: vi.fn(),
    withAuth: vi.fn(),
    createPersonalAgentSkillForContext: vi.fn(),
}));

vi.mock("@sourcebot/shared", () => ({
    createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
    env: { AUTH_URL: "https://sourcebot.example.com" },
}));

vi.mock("@/features/chat/utils.server", () => ({
    checkAskEntitlement: mocks.checkAskEntitlement,
}));

vi.mock("@/middleware/withAuth", () => ({
    withAuth: mocks.withAuth,
}));

vi.mock("@/ee/features/chat/skills/skillCreation", () => ({
    createPersonalAgentSkillForContext: mocks.createPersonalAgentSkillForContext,
}));

const { createSkillDefinition } = await import("./createSkill");

const validInput = {
    name: "Review PR",
    slug: "Review PR",
    description: "Review a pull request.",
    instructions: "Look for correctness issues first.",
};

const createdSkill = {
    id: "skill-1",
    scope: "PERSONAL",
    slug: "review-pr",
    name: "Review PR",
    description: "Review a pull request.",
    instructions: "Look for correctness issues first.",
    enabled: true,
    source: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
    vi.clearAllMocks();
    mocks.authContext = {
        org: { id: 1 },
        user: { id: "user-1" },
        prisma: {},
        principal: { source: "api_key" },
    };
    mocks.withAuth.mockImplementation(async (callback: (context: unknown) => unknown) => callback(mocks.authContext));
    mocks.checkAskEntitlement.mockResolvedValue(null);
    mocks.createPersonalAgentSkillForContext.mockResolvedValue(createdSkill);
});

describe("createSkillDefinition", () => {
    test("has the expected definition flags", () => {
        expect(createSkillDefinition.name).toBe("create_skill");
        expect(createSkillDefinition.isReadOnly).toBe(false);
        expect(createSkillDefinition.isIdempotent).toBe(false);
        expect(createSkillDefinition.isDestructive).toBe(false);
    });

    test("normalizes the slug before creating", async () => {
        await createSkillDefinition.execute(validInput, { source: "sourcebot-ask-agent" });

        expect(mocks.createPersonalAgentSkillForContext).toHaveBeenCalledWith(expect.objectContaining({
            userId: "user-1",
            orgId: 1,
            input: expect.objectContaining({ slug: "review-pr" }),
            analytics: {
                source: "sourcebot-ask-agent",
                entryPoint: "agent_tool",
                creationMethod: "manual",
            },
        }));
    });

    test("throws the schema message on invalid input without calling withAuth", async () => {
        await expect(createSkillDefinition.execute(
            { ...validInput, name: " " },
            { source: "sourcebot-ask-agent" },
        )).rejects.toThrow("Name is required.");

        expect(mocks.withAuth).not.toHaveBeenCalled();
        expect(mocks.createPersonalAgentSkillForContext).not.toHaveBeenCalled();
    });

    test("throws when the requester is not authenticated", async () => {
        mocks.withAuth.mockResolvedValue({
            statusCode: StatusCodes.UNAUTHORIZED,
            errorCode: ErrorCode.NOT_AUTHENTICATED,
            message: "Not authenticated",
        });

        await expect(createSkillDefinition.execute(validInput, { source: "sourcebot-ask-agent" }))
            .rejects.toThrow("Authentication is required to create skills.");
    });

    test("rejects a repository-scoped access token without creating", async () => {
        mocks.authContext = {
            org: { id: 1 },
            user: { id: "user-1" },
            prisma: {},
            principal: { source: "scoped_access_token" },
        };

        await expect(createSkillDefinition.execute(validInput, { source: "sourcebot-mcp-server" }))
            .rejects.toThrow("Repository-scoped access tokens cannot manage skills.");
        expect(mocks.createPersonalAgentSkillForContext).not.toHaveBeenCalled();
    });

    test("throws the entitlement message when Ask is not available", async () => {
        mocks.checkAskEntitlement.mockResolvedValue({
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
            message: "Ask Sourcebot is not available in your current plan",
        });

        await expect(createSkillDefinition.execute(validInput, { source: "sourcebot-ask-agent" }))
            .rejects.toThrow("Ask Sourcebot is not available in your current plan");
        expect(mocks.createPersonalAgentSkillForContext).not.toHaveBeenCalled();
    });

    test("surfaces a slug conflict with the actionable message", async () => {
        mocks.createPersonalAgentSkillForContext.mockResolvedValue({
            statusCode: StatusCodes.CONFLICT,
            errorCode: ErrorCode.AGENT_SKILL_ALREADY_EXISTS,
            message: "A skill with command /review-pr already exists.",
        });

        await expect(createSkillDefinition.execute(validInput, { source: "sourcebot-ask-agent" }))
            .rejects.toThrow("A skill with command /review-pr already exists.");
    });

    test("returns the created skill as JSON output plus UI metadata with a settings deep link", async () => {
        const result = await createSkillDefinition.execute(validInput, { source: "sourcebot-mcp-server" });

        const url = "https://sourcebot.example.com/settings/skills?skill=skill-1";
        expect(JSON.parse(result.output)).toEqual({
            id: "skill-1",
            slug: "review-pr",
            name: "Review PR",
            description: "Review a pull request.",
            enabled: true,
            createdAt: "2026-01-01T00:00:00.000Z",
            url,
        });
        expect(result.metadata).toEqual({
            id: "skill-1",
            slug: "review-pr",
            name: "Review PR",
            url,
        });
        // Instructions are never echoed back.
        expect(result.output).not.toContain("Look for correctness issues first.");
        expect(mocks.createPersonalAgentSkillForContext).toHaveBeenCalledWith(expect.objectContaining({
            analytics: expect.objectContaining({ source: "sourcebot-mcp-server" }),
        }));
    });
});
