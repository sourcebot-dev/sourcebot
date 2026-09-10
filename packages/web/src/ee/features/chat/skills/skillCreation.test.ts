import { beforeEach, describe, expect, test, vi } from "vitest";
import { OrgRole, Prisma } from "@sourcebot/db";
import { ErrorCode } from "@/lib/errorCodes";
import { StatusCodes } from "http-status-codes";

const mocks = vi.hoisted(() => ({
    captureEvent: vi.fn(),
}));

vi.mock("@/lib/posthog", () => ({
    captureEvent: mocks.captureEvent,
}));

const { createPersonalAgentSkillForContext, updateAgentSkillForContext } = await import("./skillCreation");

function createPrismaMock() {
    return {
        agentSkill: {
            create: vi.fn(),
            findFirst: vi.fn(),
            update: vi.fn(),
        },
    };
}

const uniqueConstraintError = () =>
    new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "0",
    });

const validInput = {
    slug: "review",
    name: "Review",
    description: "Review risky changes.",
    instructions: "Review the change.",
};

const createdRow = {
    id: "skill-1",
    visibility: "PERSONAL" as const,
    slug: "review",
    name: "Review",
    description: "Review risky changes.",
    instructions: "Review the change.",
    enabled: true,
    sourceRepoName: null,
    sourceFilePath: null,
    sourceRevision: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

const analytics = {
    source: "sourcebot-ask-agent" as const,
    entryPoint: "agent_tool" as const,
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe("createPersonalAgentSkillForContext", () => {
    test("creates the skill in the personal scope with creator/updater set", async () => {
        const prisma = createPrismaMock();
        prisma.agentSkill.create.mockResolvedValue(createdRow);

        const result = await createPersonalAgentSkillForContext({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            prisma: prisma as any,
            userId: "user-1",
            orgId: 1,
            input: validInput,
            analytics: { ...analytics, creationMethod: "manual" },
        });

        expect(prisma.agentSkill.create).toHaveBeenCalledWith({
            data: {
                visibility: "PERSONAL",
                scopeId: "user-1",
                orgId: 1,
                slug: "review",
                name: "Review",
                description: "Review risky changes.",
                instructions: "Review the change.",
                createdById: "user-1",
                updatedById: "user-1",
            },
        });
        expect(result).toMatchObject({ id: "skill-1", slug: "review", enabled: true });
        expect(mocks.captureEvent).toHaveBeenCalledWith("ask_skill_created", expect.objectContaining({
            source: "sourcebot-ask-agent",
            entryPoint: "agent_tool",
            scope: "personal",
            creationMethod: "manual",
            isSynced: false,
            success: true,
        }));
    });

    test("maps a unique-constraint error to AGENT_SKILL_ALREADY_EXISTS with failure analytics", async () => {
        const prisma = createPrismaMock();
        prisma.agentSkill.create.mockRejectedValue(uniqueConstraintError());

        const result = await createPersonalAgentSkillForContext({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            prisma: prisma as any,
            userId: "user-1",
            orgId: 1,
            input: validInput,
            analytics: { ...analytics, creationMethod: "manual" },
        });

        expect(result).toEqual({
            statusCode: StatusCodes.CONFLICT,
            errorCode: ErrorCode.AGENT_SKILL_ALREADY_EXISTS,
            message: "A skill with command /review already exists.",
        });
        expect(mocks.captureEvent).toHaveBeenCalledWith("ask_skill_created", expect.objectContaining({
            success: false,
            failureReason: ErrorCode.AGENT_SKILL_ALREADY_EXISTS,
        }));
    });

    test("emits failure analytics and rethrows on unexpected errors", async () => {
        const prisma = createPrismaMock();
        const unexpected = new Error("db down");
        prisma.agentSkill.create.mockRejectedValue(unexpected);

        await expect(createPersonalAgentSkillForContext({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            prisma: prisma as any,
            userId: "user-1",
            orgId: 1,
            input: validInput,
            analytics: { ...analytics, creationMethod: "manual" },
        })).rejects.toThrow("db down");

        expect(mocks.captureEvent).toHaveBeenCalledWith("ask_skill_created", expect.objectContaining({
            success: false,
            failureReason: ErrorCode.UNEXPECTED_ERROR,
        }));
    });
});

const existingPersonalRow = {
    id: "skill-1",
    name: "Review",
    slug: "review",
    description: "Review risky changes.",
    instructions: "Review the change.",
    sourceRepoName: null,
    createdById: "user-1",
};

const updatedRow = {
    ...createdRow,
    name: "Renamed",
    slug: "renamed",
};

describe("updateAgentSkillForContext", () => {
    test("resolves a personal skill by slug and merges partial fields over the existing values", async () => {
        const prisma = createPrismaMock();
        prisma.agentSkill.findFirst.mockResolvedValue(existingPersonalRow);
        prisma.agentSkill.update.mockResolvedValue(updatedRow);

        const result = await updateAgentSkillForContext({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            prisma: prisma as any,
            userId: "user-1",
            orgId: 1,
            target: { scope: "personal", slug: "review" },
            fields: { name: "Renamed" },
            policy: { sharedManageableBy: "creator", allowSynced: false },
            analytics,
        });

        expect(prisma.agentSkill.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                slug: "review",
                visibility: "PERSONAL",
                scopeId: "user-1",
                orgId: 1,
                createdById: "user-1",
            },
        }));
        expect(prisma.agentSkill.update).toHaveBeenCalledWith({
            where: { id: "skill-1" },
            data: {
                slug: "review",
                name: "Renamed",
                description: "Review risky changes.",
                instructions: "Review the change.",
                updatedById: "user-1",
            },
        });
        expect(result).toMatchObject({ id: "skill-1" });
        expect(mocks.captureEvent).toHaveBeenCalledWith("ask_skill_updated", expect.objectContaining({
            source: "sourcebot-ask-agent",
            entryPoint: "agent_tool",
            scope: "personal",
            changedFieldTypes: ["name"],
            success: true,
        }));
    });

    test("the creator-only policy rejects an org owner who is not the creator", async () => {
        const prisma = createPrismaMock();
        prisma.agentSkill.findFirst.mockResolvedValue({
            ...existingPersonalRow,
            createdById: "author-1",
        });

        const result = await updateAgentSkillForContext({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            prisma: prisma as any,
            userId: "owner-1",
            orgId: 1,
            role: OrgRole.OWNER,
            target: { scope: "shared", slug: "review" },
            fields: { name: "Renamed" },
            policy: { sharedManageableBy: "creator", allowSynced: false },
            analytics,
        });

        expect(result).toEqual({
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
            message: "You do not have sufficient permissions to manage this skill.",
        });
        expect(prisma.agentSkill.update).not.toHaveBeenCalled();
    });

    test("the creator-or-owner policy lets an org owner edit another author's shared skill", async () => {
        const prisma = createPrismaMock();
        prisma.agentSkill.findFirst.mockResolvedValue({
            ...existingPersonalRow,
            createdById: "author-1",
        });
        prisma.agentSkill.update.mockResolvedValue({ ...updatedRow, visibility: "SHARED" as const });

        const result = await updateAgentSkillForContext({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            prisma: prisma as any,
            userId: "owner-1",
            orgId: 1,
            role: OrgRole.OWNER,
            target: { scope: "shared", id: "skill-1" },
            fields: { name: "Renamed" },
            policy: { sharedManageableBy: "creator-or-owner", allowSynced: true },
            analytics,
        });

        expect(prisma.agentSkill.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                id: "skill-1",
                visibility: "SHARED",
                scopeId: "1",
                orgId: 1,
                enabled: true,
            },
        }));
        expect(result).toMatchObject({ id: "skill-1" });
    });

    test("rejects a synced skill with the source-naming error and no write", async () => {
        const prisma = createPrismaMock();
        prisma.agentSkill.findFirst.mockResolvedValue({
            ...existingPersonalRow,
            sourceRepoName: "github.com/acme/widgets",
        });

        const result = await updateAgentSkillForContext({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            prisma: prisma as any,
            userId: "user-1",
            orgId: 1,
            target: { scope: "personal", slug: "review" },
            fields: { name: "Renamed" },
            policy: { sharedManageableBy: "creator", allowSynced: false },
            analytics,
        });

        expect(result).toMatchObject({
            errorCode: ErrorCode.INVALID_REQUEST_BODY,
            message: expect.stringContaining("github.com/acme/widgets"),
        });
        expect(result).toMatchObject({
            message: expect.stringContaining("Settings → Skills"),
        });
        expect(prisma.agentSkill.update).not.toHaveBeenCalled();
    });

    test("returns skillNotFound for a disabled shared skill (the enabled filter excludes it)", async () => {
        const prisma = createPrismaMock();
        prisma.agentSkill.findFirst.mockResolvedValue(null);

        const result = await updateAgentSkillForContext({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            prisma: prisma as any,
            userId: "user-1",
            orgId: 1,
            target: { scope: "shared", slug: "review" },
            fields: { name: "Renamed" },
            policy: { sharedManageableBy: "creator", allowSynced: false },
            analytics,
        });

        expect(result).toEqual({
            statusCode: StatusCodes.NOT_FOUND,
            errorCode: ErrorCode.AGENT_SKILL_NOT_FOUND,
            message: "Skill not found.",
        });
        expect(prisma.agentSkill.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ enabled: true }),
        }));
    });

    test("maps a slug conflict on rename to AGENT_SKILL_ALREADY_EXISTS with failure analytics", async () => {
        const prisma = createPrismaMock();
        prisma.agentSkill.findFirst.mockResolvedValue(existingPersonalRow);
        prisma.agentSkill.update.mockRejectedValue(uniqueConstraintError());

        const result = await updateAgentSkillForContext({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            prisma: prisma as any,
            userId: "user-1",
            orgId: 1,
            target: { scope: "personal", slug: "review" },
            fields: { slug: "taken" },
            policy: { sharedManageableBy: "creator", allowSynced: false },
            analytics,
        });

        expect(result).toEqual({
            statusCode: StatusCodes.CONFLICT,
            errorCode: ErrorCode.AGENT_SKILL_ALREADY_EXISTS,
            message: "A skill with command /taken already exists.",
        });
        expect(mocks.captureEvent).toHaveBeenCalledWith("ask_skill_updated", expect.objectContaining({
            source: "sourcebot-ask-agent",
            entryPoint: "agent_tool",
            success: false,
            failureReason: ErrorCode.AGENT_SKILL_ALREADY_EXISTS,
        }));
    });

    test("validates the merged result with the schema messages", async () => {
        const prisma = createPrismaMock();
        prisma.agentSkill.findFirst.mockResolvedValue(existingPersonalRow);

        const result = await updateAgentSkillForContext({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            prisma: prisma as any,
            userId: "user-1",
            orgId: 1,
            target: { scope: "personal", slug: "review" },
            fields: { name: " " },
            policy: { sharedManageableBy: "creator", allowSynced: false },
            analytics,
        });

        expect(result).toMatchObject({ errorCode: ErrorCode.INVALID_REQUEST_BODY });
        expect(prisma.agentSkill.update).not.toHaveBeenCalled();
    });
});
