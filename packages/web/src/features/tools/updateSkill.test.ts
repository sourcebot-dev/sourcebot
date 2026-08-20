import { beforeEach, describe, expect, test, vi } from "vitest";
import { ErrorCode } from "@/lib/errorCodes";
import { StatusCodes } from "http-status-codes";

const mocks = vi.hoisted(() => ({
    authContext: undefined as unknown,
    checkAskEntitlement: vi.fn(),
    withAuth: vi.fn(),
    updateAgentSkillForContext: vi.fn(),
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
    updateAgentSkillForContext: mocks.updateAgentSkillForContext,
}));

const { updateSkillDefinition } = await import("./updateSkill");

const updatedSkill = {
    id: "skill-1",
    scope: "PERSONAL",
    slug: "review-pr",
    name: "Review PR",
    description: "Review a pull request.",
    instructions: "Look for correctness issues first.",
    enabled: true,
    source: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
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
    mocks.updateAgentSkillForContext.mockResolvedValue(updatedSkill);
});

describe("updateSkillDefinition", () => {
    test("has the expected definition flags", () => {
        expect(updateSkillDefinition.name).toBe("update_skill");
        expect(updateSkillDefinition.isReadOnly).toBe(false);
        expect(updateSkillDefinition.isIdempotent).toBe(true);
        expect(updateSkillDefinition.isDestructive).toBe(true);
    });

    test("passes only the provided fields so unspecified fields keep their current values", async () => {
        await updateSkillDefinition.execute(
            { slug: "Review PR", scope: "personal", name: "Renamed" },
            { source: "sourcebot-ask-agent" },
        );

        expect(mocks.updateAgentSkillForContext).toHaveBeenCalledWith({
            prisma: {},
            userId: "user-1",
            orgId: 1,
            // The lookup slug is normalized for forgiveness.
            target: { scope: "personal", slug: "review-pr" },
            fields: { name: "Renamed" },
            policy: { sharedManageableBy: "creator", allowSynced: false },
            analytics: {
                source: "sourcebot-ask-agent",
                entryPoint: "agent_tool",
            },
        });
    });

    test("maps newSlug to the slug field", async () => {
        await updateSkillDefinition.execute(
            { slug: "review-pr", scope: "shared", newSlug: "review-pr-v2", instructions: "New instructions." },
            { source: "sourcebot-mcp-server" },
        );

        expect(mocks.updateAgentSkillForContext).toHaveBeenCalledWith(expect.objectContaining({
            target: { scope: "shared", slug: "review-pr" },
            fields: { slug: "review-pr-v2", instructions: "New instructions." },
            analytics: expect.objectContaining({ source: "sourcebot-mcp-server" }),
        }));
    });

    test("throws when no skill matches the slug + scope", async () => {
        mocks.updateAgentSkillForContext.mockResolvedValue({
            statusCode: StatusCodes.NOT_FOUND,
            errorCode: ErrorCode.AGENT_SKILL_NOT_FOUND,
            message: "Skill not found.",
        });

        await expect(updateSkillDefinition.execute(
            { slug: "ghost", scope: "personal", name: "Renamed" },
            { source: "sourcebot-ask-agent" },
        )).rejects.toThrow("Skill not found.");
    });

    test("throws when the requester is not authenticated", async () => {
        mocks.withAuth.mockResolvedValue({
            statusCode: StatusCodes.UNAUTHORIZED,
            errorCode: ErrorCode.NOT_AUTHENTICATED,
            message: "Not authenticated",
        });

        await expect(updateSkillDefinition.execute(
            { slug: "review-pr", scope: "personal", name: "Renamed" },
            { source: "sourcebot-ask-agent" },
        )).rejects.toThrow("Authentication is required to update skills.");
    });

    test("rejects a repository-scoped access token without updating", async () => {
        mocks.authContext = {
            org: { id: 1 },
            user: { id: "user-1" },
            prisma: {},
            principal: { source: "scoped_access_token" },
        };

        await expect(updateSkillDefinition.execute(
            { slug: "review-pr", scope: "personal", name: "Renamed" },
            { source: "sourcebot-mcp-server" },
        )).rejects.toThrow("Repository-scoped access tokens cannot manage skills.");
        expect(mocks.updateAgentSkillForContext).not.toHaveBeenCalled();
    });

    test("returns the updated skill as JSON output plus UI metadata with the tool's scope", async () => {
        const result = await updateSkillDefinition.execute(
            { slug: "review-pr", scope: "personal", name: "Review PR" },
            { source: "sourcebot-ask-agent" },
        );

        const url = "https://sourcebot.example.com/settings/skills?skill=skill-1";
        expect(JSON.parse(result.output)).toEqual({
            id: "skill-1",
            slug: "review-pr",
            name: "Review PR",
            description: "Review a pull request.",
            scope: "personal",
            enabled: true,
            updatedAt: "2026-01-02T00:00:00.000Z",
            url,
        });
        expect(result.metadata).toEqual({
            id: "skill-1",
            slug: "review-pr",
            name: "Review PR",
            scope: "personal",
            url,
        });
    });
});
