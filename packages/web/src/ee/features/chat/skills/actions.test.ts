import { beforeEach, describe, expect, test, vi } from "vitest";
import { OrgRole } from "@sourcebot/db";
import { ErrorCode } from "@/lib/errorCodes";
import { StatusCodes } from "http-status-codes";

const mocks = vi.hoisted(() => ({
    authContext: undefined as unknown,
    checkAskEntitlement: vi.fn(),
}));

vi.mock("@/features/chat/utils.server", () => ({
    checkAskEntitlement: mocks.checkAskEntitlement,
}));

vi.mock("@/middleware/withAuth", () => ({
    withAuth: vi.fn((callback: (context: unknown) => unknown) => callback(mocks.authContext)),
}));

vi.mock("@sourcebot/shared", () => ({
    createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
    env: { NODE_ENV: "test" },
}));

const {
    adoptOrgSkill,
    deleteOrgAgentSkill,
    listAgentSkillCommands,
    setOrgSkillFlag,
    unadoptOrgSkill,
    updateOrgAgentSkill,
} = await import("./actions");

function createPrismaMock() {
    return {
        agentSkill: {
            delete: vi.fn(),
            findFirst: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn(),
        },
        agentSkillAdoption: {
            upsert: vi.fn(),
            deleteMany: vi.fn(),
        },
    };
}

function setAuthContext({
    role,
    userId = "member-1",
    prisma = createPrismaMock(),
}: {
    role: OrgRole;
    userId?: string;
    prisma?: ReturnType<typeof createPrismaMock>;
}) {
    mocks.authContext = {
        org: { id: 1 },
        user: { id: userId },
        role,
        prisma,
    };
    return prisma;
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkAskEntitlement.mockResolvedValue(undefined);
});

describe("listAgentSkillCommands", () => {
    test("checks entitlement once while loading personal and org commands", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findMany
            .mockResolvedValueOnce([{
                id: "personal-skill",
                slug: "review",
                name: "Review",
                description: "Personal review.",
                instructions: "Review $0.",
                argumentNames: [],
            }])
            .mockResolvedValueOnce([{
                id: "org-skill",
                slug: "review",
                name: "Review",
                description: "Workspace review.",
                instructions: "Review $0 with workspace rules.",
                argumentNames: [],
            }]);

        const result = await listAgentSkillCommands();

        expect(mocks.checkAskEntitlement).toHaveBeenCalledTimes(1);
        expect(prisma.agentSkill.findMany).toHaveBeenCalledTimes(2);
        expect(prisma.agentSkill.findMany).toHaveBeenNthCalledWith(1, {
            where: {
                visibility: "PERSONAL",
                scopeId: "member-1",
                createdById: "member-1",
                orgId: null,
                enabled: true,
            },
            orderBy: [
                { updatedAt: "desc" },
                { name: "asc" },
            ],
            select: {
                id: true,
                slug: true,
                name: true,
                description: true,
                instructions: true,
                argumentNames: true,
            },
        });
        expect(prisma.agentSkill.findMany).toHaveBeenNthCalledWith(2, {
            where: {
                visibility: "ORG",
                scopeId: "1",
                orgId: 1,
                enabled: true,
                OR: [
                    { autoEnrolled: true },
                    {
                        adoptions: {
                            some: {
                                userId: "member-1",
                                orgId: 1,
                            },
                        },
                    },
                ],
            },
            orderBy: [
                { updatedAt: "desc" },
                { name: "asc" },
            ],
            select: {
                id: true,
                slug: true,
                name: true,
                description: true,
                instructions: true,
                argumentNames: true,
            },
        });
        expect(result).toMatchObject([
            {
                id: "personal-skill",
                sourceId: "personal-skill",
                sourceLabel: "Personal",
                slug: "review",
            },
            {
                id: "org-skill",
                sourceId: "org-skill",
                sourceLabel: "Workspace",
                slug: "review",
            },
        ]);
    });
});

describe("deleteOrgAgentSkill", () => {
    test("returns forbidden when a member deletes another author's org skill", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst.mockResolvedValue({
            id: "skill-1",
            createdById: "author-1",
        });

        const result = await deleteOrgAgentSkill("skill-1");

        expect(result).toEqual({
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
            message: "You do not have sufficient permissions to manage this skill.",
        });
        expect(prisma.agentSkill.findFirst).toHaveBeenCalledWith({
            where: {
                id: "skill-1",
                visibility: "ORG",
                scopeId: "1",
                orgId: 1,
            },
            select: {
                id: true,
                createdById: true,
            },
        });
        expect(prisma.agentSkill.delete).not.toHaveBeenCalled();
    });

    test("deletes the org skill when the author requests it", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER, userId: "author-1" });
        prisma.agentSkill.findFirst.mockResolvedValue({
            id: "skill-1",
            createdById: "author-1",
        });

        const result = await deleteOrgAgentSkill("skill-1");

        expect(result).toEqual({ success: true });
        expect(prisma.agentSkill.delete).toHaveBeenCalledWith({
            where: { id: "skill-1" },
        });
    });

    test("deletes another author's org skill when an owner requests it", async () => {
        const prisma = setAuthContext({ role: OrgRole.OWNER });
        prisma.agentSkill.findFirst.mockResolvedValue({
            id: "skill-1",
            createdById: "author-1",
        });

        const result = await deleteOrgAgentSkill("skill-1");

        expect(result).toEqual({ success: true });
        expect(prisma.agentSkill.delete).toHaveBeenCalledWith({
            where: { id: "skill-1" },
        });
    });
});

const validUpdateInput = {
    id: "skill-1",
    name: "Review",
    slug: "review",
    description: "Review risky changes.",
    instructions: "Review $0.",
    argumentNames: [],
};

describe("updateOrgAgentSkill", () => {
    test("returns forbidden when a member updates another author's org skill", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst.mockResolvedValue({
            id: "skill-1",
            createdById: "author-1",
        });

        const result = await updateOrgAgentSkill(validUpdateInput);

        expect(result).toEqual({
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
            message: "You do not have sufficient permissions to manage this skill.",
        });
        expect(prisma.agentSkill.update).not.toHaveBeenCalled();
    });

    test("updates the org skill when the author requests it", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER, userId: "author-1" });
        prisma.agentSkill.findFirst.mockResolvedValue({
            id: "skill-1",
            createdById: "author-1",
        });
        prisma.agentSkill.update.mockResolvedValue({
            id: "skill-1",
            visibility: "ORG",
            slug: "review",
            name: "Review",
            description: "Review risky changes.",
            instructions: "Review $0.",
            argumentNames: [],
            enabled: true,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        });

        const result = await updateOrgAgentSkill(validUpdateInput);

        expect(result).toMatchObject({ id: "skill-1", slug: "review" });
        expect(prisma.agentSkill.update).toHaveBeenCalledWith({
            where: { id: "skill-1" },
            data: {
                slug: "review",
                name: "Review",
                description: "Review risky changes.",
                instructions: "Review $0.",
                argumentNames: [],
                updatedById: "author-1",
            },
        });
    });
});

describe("adoptOrgSkill", () => {
    test("returns skillNotFound when the skill is disabled or missing, and never records adoption", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst.mockResolvedValue(null);

        const result = await adoptOrgSkill("skill-1");

        expect(result).toEqual({
            statusCode: StatusCodes.NOT_FOUND,
            errorCode: ErrorCode.AGENT_SKILL_NOT_FOUND,
            message: "Skill not found.",
        });
        // The adopt lookup requires `enabled: true`, so a disabled skill is invisible here.
        expect(prisma.agentSkill.findFirst).toHaveBeenCalledWith({
            where: {
                id: "skill-1",
                visibility: "ORG",
                scopeId: "1",
                orgId: 1,
                enabled: true,
            },
            select: {
                id: true,
            },
        });
        expect(prisma.agentSkillAdoption.upsert).not.toHaveBeenCalled();
    });

    test("records the adoption when the skill is enabled", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst.mockResolvedValue({ id: "skill-1" });

        const result = await adoptOrgSkill("skill-1");

        expect(result).toEqual({ success: true });
        expect(prisma.agentSkillAdoption.upsert).toHaveBeenCalledWith({
            where: {
                orgId_userId_agentSkillId: {
                    orgId: 1,
                    userId: "member-1",
                    agentSkillId: "skill-1",
                },
            },
            create: {
                orgId: 1,
                userId: "member-1",
                agentSkillId: "skill-1",
            },
            update: {},
        });
    });
});

describe("unadoptOrgSkill", () => {
    test("removes the adoption against a disabled skill, since its lookup omits the enabled filter", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst.mockResolvedValue({ id: "skill-1" });

        const result = await unadoptOrgSkill("skill-1");

        expect(result).toEqual({ success: true });
        // Unlike adopt, the unadopt lookup does NOT filter on `enabled`.
        expect(prisma.agentSkill.findFirst).toHaveBeenCalledWith({
            where: {
                id: "skill-1",
                visibility: "ORG",
                scopeId: "1",
                orgId: 1,
            },
            select: {
                id: true,
            },
        });
        expect(prisma.agentSkillAdoption.deleteMany).toHaveBeenCalledWith({
            where: {
                orgId: 1,
                userId: "member-1",
                agentSkillId: "skill-1",
            },
        });
    });
});

describe("setOrgSkillFlag", () => {
    test("updates a single org skill flag through the shared owner-gated path", async () => {
        const prisma = setAuthContext({ role: OrgRole.OWNER });
        prisma.agentSkill.findFirst.mockResolvedValue({
            id: "skill-1",
        });
        prisma.agentSkill.update.mockResolvedValue({
            id: "skill-1",
            visibility: "ORG",
            slug: "review",
            name: "Review",
            description: "Review risky changes.",
            argumentNames: [],
            enabled: true,
            featured: true,
            autoEnrolled: false,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-02T00:00:00.000Z"),
            adoptions: [],
        });

        const result = await setOrgSkillFlag({
            skillId: "skill-1",
            data: { featured: true },
        });

        expect(prisma.agentSkill.findFirst).toHaveBeenCalledWith({
            where: {
                id: "skill-1",
                visibility: "ORG",
                scopeId: "1",
                orgId: 1,
            },
            select: {
                id: true,
            },
        });
        expect(prisma.agentSkill.update).toHaveBeenCalledWith({
            where: { id: "skill-1" },
            data: {
                featured: true,
                updatedById: "member-1",
            },
            select: expect.any(Object),
        });
        expect(result).toMatchObject({
            id: "skill-1",
            featured: true,
            autoEnrolled: false,
        });
    });

    test("rejects a non-owner through the owner gate without touching the skill", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });

        const result = await setOrgSkillFlag({
            skillId: "skill-1",
            data: { featured: true },
        });

        expect(result).toEqual({
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
            message: "You do not have sufficient permissions to perform this action.",
        });
        // The owner gate returns before its callback runs, so the skill is never looked up or updated.
        expect(prisma.agentSkill.findFirst).not.toHaveBeenCalled();
        expect(prisma.agentSkill.update).not.toHaveBeenCalled();
    });

    test("rejects multi-flag updates", async () => {
        setAuthContext({ role: OrgRole.OWNER });

        const result = await setOrgSkillFlag({
            skillId: "skill-1",
            data: {
                featured: true,
                autoEnrolled: true,
            },
        });

        expect(result).toMatchObject({
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.INVALID_REQUEST_BODY,
        });
        expect(mocks.checkAskEntitlement).not.toHaveBeenCalled();
    });
});
