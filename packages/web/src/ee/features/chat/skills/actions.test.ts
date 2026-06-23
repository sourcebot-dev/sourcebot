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
    createOrgAgentSkill,
    deleteOrgAgentSkill,
    getOrgAgentSkill,
    listAgentSkillCommands,
    listOrgAgentSkillManagement,
    makeOrgAgentSkillPersonal,
    publishPersonalAgentSkillToOrg,
    setOrgSkillFlag,
    unadoptOrgSkill,
    updateOrgAgentSkill,
} = await import("./actions");

function createPrismaMock() {
    const prisma = {
        agentSkill: {
            create: vi.fn(),
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
    return {
        ...prisma,
        $transaction: vi.fn((callback) => callback(prisma)),
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

const validCreateInput = {
    slug: "review",
    name: "Review",
    description: "Review risky changes.",
    instructions: "Review $0.",
    argumentNames: ["topic"],
    autoInvocationEnabled: false,
};

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
                AND: [
                    {
                        OR: [
                            { autoEnrolled: true },
                            {
                                adoptions: {
                                    some: {
                                        userId: "member-1",
                                        orgId: 1,
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
                                    userId: "member-1",
                                    orgId: 1,
                                    removedAt: {
                                        not: null,
                                    },
                                },
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

describe("createOrgAgentSkill", () => {
    test("creates and adopts an org skill for the creator", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.create.mockResolvedValue({
            id: "org-skill",
            visibility: "ORG",
            slug: "review",
            name: "Review",
            description: "Review risky changes.",
            instructions: "Review $0.",
            argumentNames: ["topic"],
            enabled: true,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        });

        const result = await createOrgAgentSkill(validCreateInput);

        expect(result).toMatchObject({
            id: "org-skill",
            slug: "review",
        });
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(prisma.agentSkill.create).toHaveBeenCalledWith({
            data: {
                visibility: "ORG",
                scopeId: "1",
                slug: "review",
                name: "Review",
                description: "Review risky changes.",
                instructions: "Review $0.",
                argumentNames: ["topic"],
                autoInvocationEnabled: false,
                createdById: "member-1",
                updatedById: "member-1",
                orgId: 1,
                adoptions: {
                    create: {
                        orgId: 1,
                        userId: "member-1",
                        removedAt: null,
                    },
                },
            },
        });
        expect(prisma.agentSkillAdoption.upsert).not.toHaveBeenCalled();
    });
});

describe("publishPersonalAgentSkillToOrg", () => {
    test("moves a personal skill into the org and adopts it for the publisher", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst
            .mockResolvedValueOnce({
                slug: "review",
                name: "Review",
                description: "Review risky changes.",
                instructions: "Review $0.",
                argumentNames: ["topic"],
            })
            .mockResolvedValueOnce({
                id: "org-skill",
                visibility: "ORG",
                slug: "review",
                name: "Review",
                description: "Review risky changes.",
                argumentNames: ["topic"],
                enabled: true,
                featured: false,
                autoEnrolled: false,
                createdById: "member-1",
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                updatedAt: new Date("2026-01-02T00:00:00.000Z"),
                adoptions: [{ id: "adoption-1", removedAt: null }],
            });
        prisma.agentSkill.create.mockResolvedValue({
            id: "org-skill",
        });

        const result = await publishPersonalAgentSkillToOrg("personal-skill");

        expect(result).toMatchObject({
            id: "org-skill",
            slug: "review",
            isAdopted: true,
            isCreatedByUser: true,
        });
        expect(prisma.agentSkill.findFirst).toHaveBeenNthCalledWith(1, {
            where: {
                id: "personal-skill",
                visibility: "PERSONAL",
                scopeId: "member-1",
                createdById: "member-1",
                orgId: null,
            },
            select: {
                slug: true,
                name: true,
                description: true,
                instructions: true,
                argumentNames: true,
            },
        });
        expect(prisma.agentSkill.create).toHaveBeenCalledWith({
            data: {
                visibility: "ORG",
                scopeId: "1",
                slug: "review",
                name: "Review",
                description: "Review risky changes.",
                instructions: "Review $0.",
                argumentNames: ["topic"],
                autoInvocationEnabled: false,
                createdById: "member-1",
                updatedById: "member-1",
                orgId: 1,
                adoptions: {
                    create: {
                        orgId: 1,
                        userId: "member-1",
                        removedAt: null,
                    },
                },
            },
            select: {
                id: true,
            },
        });
        expect(prisma.agentSkillAdoption.upsert).not.toHaveBeenCalled();
        expect(prisma.agentSkill.delete).toHaveBeenCalledWith({
            where: {
                id: "personal-skill",
            },
        });
        expect(prisma.agentSkill.findFirst).toHaveBeenNthCalledWith(2, {
            where: {
                id: "org-skill",
                visibility: "ORG",
                scopeId: "1",
                orgId: 1,
            },
            select: expect.any(Object),
        });
    });
});

describe("makeOrgAgentSkillPersonal", () => {
    test("moves the workspace skill to personal when the user authored it", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst
            .mockResolvedValueOnce({
                id: "org-skill",
                slug: "review",
                name: "Review",
                description: "Review risky changes.",
                instructions: "Review $0.",
                argumentNames: ["topic"],
                createdById: "member-1",
                autoEnrolled: false,
            });
        prisma.agentSkill.create.mockResolvedValue({
            id: "personal-skill",
            visibility: "PERSONAL",
            slug: "review",
            name: "Review",
            description: "Review risky changes.",
            instructions: "Review $0.",
            argumentNames: ["topic"],
            enabled: true,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        });

        const result = await makeOrgAgentSkillPersonal("org-skill");

        expect(result).toMatchObject({
            id: "personal-skill",
            scope: "PERSONAL",
            slug: "review",
        });
        expect(prisma.agentSkill.create).toHaveBeenCalledWith({
            data: {
                visibility: "PERSONAL",
                scopeId: "member-1",
                slug: "review",
                name: "Review",
                description: "Review risky changes.",
                instructions: "Review $0.",
                argumentNames: ["topic"],
                createdById: "member-1",
                updatedById: "member-1",
                orgId: null,
            },
        });
        expect(prisma.agentSkill.delete).toHaveBeenCalledWith({
            where: {
                id: "org-skill",
            },
        });
        expect(prisma.agentSkill.findFirst).toHaveBeenCalledTimes(1);
    });

    test("copies another user's auto-enrolled workspace skill and opts out of the workspace command", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst
            .mockResolvedValueOnce({
                id: "org-skill",
                slug: "review",
                name: "Review",
                description: "Review risky changes.",
                instructions: "Review $0.",
                argumentNames: ["topic"],
                createdById: "author-1",
                autoEnrolled: true,
            })
            .mockResolvedValueOnce({
                id: "org-skill",
            });
        prisma.agentSkill.create.mockResolvedValue({
            id: "personal-skill",
            visibility: "PERSONAL",
            slug: "review",
            name: "Review",
            description: "Review risky changes.",
            instructions: "Review $0.",
            argumentNames: ["topic"],
            enabled: true,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        });

        const result = await makeOrgAgentSkillPersonal("org-skill");

        expect(result).toMatchObject({
            id: "personal-skill",
            scope: "PERSONAL",
        });
        expect(prisma.agentSkill.delete).not.toHaveBeenCalled();
        expect(prisma.agentSkillAdoption.upsert).toHaveBeenCalledWith({
            where: {
                orgId_userId_agentSkillId: {
                    orgId: 1,
                    userId: "member-1",
                    agentSkillId: "org-skill",
                },
            },
            create: {
                orgId: 1,
                userId: "member-1",
                agentSkillId: "org-skill",
                removedAt: expect.any(Date),
            },
            update: {
                removedAt: expect.any(Date),
            },
        });
        expect(prisma.agentSkill.findFirst).toHaveBeenCalledTimes(2);
    });

    test("returns forbidden before copying another user's unavailable workspace skill", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst
            .mockResolvedValueOnce({
                id: "org-skill",
                slug: "review",
                name: "Review",
                description: "Review risky changes.",
                instructions: "Review $0.",
                argumentNames: ["topic"],
                createdById: "author-1",
                autoEnrolled: false,
            })
            .mockResolvedValueOnce(null);

        const result = await makeOrgAgentSkillPersonal("org-skill");

        expect(result).toEqual({
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
            message: "You do not have sufficient permissions to manage this skill.",
        });
        expect(prisma.agentSkill.findFirst).toHaveBeenNthCalledWith(1, {
            where: {
                id: "org-skill",
                visibility: "ORG",
                scopeId: "1",
                orgId: 1,
                enabled: true,
            },
            select: {
                id: true,
                slug: true,
                name: true,
                description: true,
                instructions: true,
                argumentNames: true,
                createdById: true,
                autoEnrolled: true,
            },
        });
        expect(prisma.agentSkill.findFirst).toHaveBeenNthCalledWith(2, {
            where: {
                id: "org-skill",
                visibility: "ORG",
                scopeId: "1",
                orgId: 1,
                enabled: true,
                AND: [
                    {
                        OR: [
                            { autoEnrolled: true },
                            {
                                adoptions: {
                                    some: {
                                        userId: "member-1",
                                        orgId: 1,
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
                                    userId: "member-1",
                                    orgId: 1,
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
            },
        });
        expect(prisma.agentSkill.create).not.toHaveBeenCalled();
        expect(prisma.agentSkill.delete).not.toHaveBeenCalled();
        expect(prisma.agentSkillAdoption.deleteMany).not.toHaveBeenCalled();
        expect(prisma.agentSkillAdoption.upsert).not.toHaveBeenCalled();
    });
});

describe("getOrgAgentSkill", () => {
    test("returns skillNotFound when the org skill is disabled or missing", async () => {
        const prisma = setAuthContext({ role: OrgRole.OWNER });
        prisma.agentSkill.findFirst.mockResolvedValue(null);

        const result = await getOrgAgentSkill("skill-1");

        expect(result).toEqual({
            statusCode: StatusCodes.NOT_FOUND,
            errorCode: ErrorCode.AGENT_SKILL_NOT_FOUND,
            message: "Skill not found.",
        });
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
                createdById: true,
            },
        });
    });
});

describe("deleteOrgAgentSkill", () => {
    test("returns skillNotFound when the org skill is disabled or missing", async () => {
        const prisma = setAuthContext({ role: OrgRole.OWNER });
        prisma.agentSkill.findFirst.mockResolvedValue(null);

        const result = await deleteOrgAgentSkill("skill-1");

        expect(result).toEqual({
            statusCode: StatusCodes.NOT_FOUND,
            errorCode: ErrorCode.AGENT_SKILL_NOT_FOUND,
            message: "Skill not found.",
        });
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
                createdById: true,
            },
        });
        expect(prisma.agentSkill.delete).not.toHaveBeenCalled();
    });

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
                enabled: true,
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
    autoInvocationEnabled: false,
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
                createdById: true,
            },
        });
        expect(prisma.agentSkill.update).not.toHaveBeenCalled();
    });

    test("returns skillNotFound when the org skill is disabled or missing", async () => {
        const prisma = setAuthContext({ role: OrgRole.OWNER });
        prisma.agentSkill.findFirst.mockResolvedValue(null);

        const result = await updateOrgAgentSkill(validUpdateInput);

        expect(result).toEqual({
            statusCode: StatusCodes.NOT_FOUND,
            errorCode: ErrorCode.AGENT_SKILL_NOT_FOUND,
            message: "Skill not found.",
        });
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
                createdById: true,
            },
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
                createdById: true,
            },
        });
        expect(prisma.agentSkill.update).toHaveBeenCalledWith({
            where: { id: "skill-1" },
            data: {
                slug: "review",
                name: "Review",
                description: "Review risky changes.",
                instructions: "Review $0.",
                argumentNames: [],
                autoInvocationEnabled: false,
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
                removedAt: null,
            },
            update: {
                removedAt: null,
            },
        });
    });
});

describe("unadoptOrgSkill", () => {
    test("removes the adoption against a disabled skill, since its lookup omits the enabled filter", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst.mockResolvedValue({ id: "skill-1", autoEnrolled: false });

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
                autoEnrolled: true,
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

    test("records an opt-out for auto-enrolled skills", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst.mockResolvedValue({ id: "skill-1", autoEnrolled: true });

        const result = await unadoptOrgSkill("skill-1");

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
                removedAt: expect.any(Date),
            },
            update: {
                removedAt: expect.any(Date),
            },
        });
        expect(prisma.agentSkillAdoption.deleteMany).not.toHaveBeenCalled();
    });
});

describe("listOrgAgentSkillManagement", () => {
    test("returns owner-management skills without requester adoption state", async () => {
        const prisma = setAuthContext({ role: OrgRole.OWNER });
        prisma.agentSkill.findMany.mockResolvedValue([{
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
        }]);

        const result = await listOrgAgentSkillManagement();

        expect(prisma.agentSkill.findMany).toHaveBeenCalledWith({
            where: {
                visibility: "ORG",
                scopeId: "1",
                orgId: 1,
                enabled: true,
            },
            orderBy: [
                { featured: "desc" },
                { updatedAt: "desc" },
                { name: "asc" },
            ],
            select: expect.not.objectContaining({
                adoptions: expect.anything(),
                createdById: expect.anything(),
            }),
        });
        expect(Array.isArray(result)).toBe(true);
        if (!Array.isArray(result)) {
            throw new Error("Expected management skills.");
        }

        expect(result).toEqual([{
            id: "skill-1",
            scope: "ORG",
            slug: "review",
            name: "Review",
            description: "Review risky changes.",
            argumentNames: [],
            enabled: true,
            featured: true,
            autoEnrolled: false,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
        }]);
        expect(result[0]).not.toHaveProperty("isAdopted");
        expect(result[0]).not.toHaveProperty("isVisibleToUser");
        expect(result[0]).not.toHaveProperty("isCreatedByUser");
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
        expect(result).not.toHaveProperty("isAdopted");
        expect(result).not.toHaveProperty("isVisibleToUser");
        expect(result).not.toHaveProperty("isCreatedByUser");
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
