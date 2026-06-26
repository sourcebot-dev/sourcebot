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
    adoptSharedSkill,
    createSharedAgentSkill,
    deleteSharedAgentSkill,
    getSharedAgentSkill,
    listAgentSkillCommands,
    listSharedAgentSkillManagement,
    makeSharedAgentSkillPersonal,
    publishPersonalAgentSkillToShared,
    setSharedSkillFlag,
    unadoptSharedSkill,
    updateSharedAgentSkill,
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
    instructions: "Review the change.",
};

describe("listAgentSkillCommands", () => {
    test("checks entitlement once while loading personal and shared commands", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findMany
            .mockResolvedValueOnce([{
                id: "personal-skill",
                slug: "review",
                name: "Review",
                description: "Personal review.",
            }])
            .mockResolvedValueOnce([{
                id: "shared-skill",
                slug: "review",
                name: "Review",
                description: "Shared review.",
            }]);

        const result = await listAgentSkillCommands();

        expect(mocks.checkAskEntitlement).toHaveBeenCalledTimes(1);
        expect(prisma.agentSkill.findMany).toHaveBeenCalledTimes(2);
        expect(prisma.agentSkill.findMany).toHaveBeenNthCalledWith(1, {
            where: {
                visibility: "PERSONAL",
                scopeId: "member-1",
                orgId: 1,
                createdById: "member-1",
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
            },
        });
        expect(prisma.agentSkill.findMany).toHaveBeenNthCalledWith(2, {
            where: {
                visibility: "SHARED",
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
                id: "shared-skill",
                sourceId: "shared-skill",
                sourceLabel: "Shared",
                slug: "review",
            },
        ]);
    });
});

describe("createSharedAgentSkill", () => {
    test("creates and adopts a shared skill for the creator", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.create.mockResolvedValue({
            id: "shared-skill",
            visibility: "SHARED",
            slug: "review",
            name: "Review",
            description: "Review risky changes.",
            instructions: "Review the change.",
            enabled: true,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        });

        const result = await createSharedAgentSkill(validCreateInput);

        expect(result).toMatchObject({
            id: "shared-skill",
            slug: "review",
        });
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(prisma.agentSkill.create).toHaveBeenCalledWith({
            data: {
                visibility: "SHARED",
                scopeId: "1",
                orgId: 1,
                slug: "review",
                name: "Review",
                description: "Review risky changes.",
                instructions: "Review the change.",
                createdById: "member-1",
                updatedById: "member-1",
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

describe("publishPersonalAgentSkillToShared", () => {
    test("moves a personal skill into the shared catalog and adopts it for the publisher", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst
            .mockResolvedValueOnce({
                slug: "review",
                name: "Review",
                description: "Review risky changes.",
                instructions: "Review the change.",
            })
            .mockResolvedValueOnce({
                id: "shared-skill",
                visibility: "SHARED",
                slug: "review",
                name: "Review",
                description: "Review risky changes.",
                enabled: true,
                autoEnrolled: false,
                createdById: "member-1",
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                updatedAt: new Date("2026-01-02T00:00:00.000Z"),
                adoptions: [{ id: "adoption-1", removedAt: null }],
            });
        prisma.agentSkill.create.mockResolvedValue({
            id: "shared-skill",
        });

        const result = await publishPersonalAgentSkillToShared("personal-skill");

        expect(result).toMatchObject({
            id: "shared-skill",
            slug: "review",
            isAdopted: true,
            isCreatedByUser: true,
        });
        expect(prisma.agentSkill.findFirst).toHaveBeenNthCalledWith(1, {
            where: {
                id: "personal-skill",
                visibility: "PERSONAL",
                scopeId: "member-1",
                orgId: 1,
                createdById: "member-1",
            },
            select: {
                slug: true,
                name: true,
                description: true,
                instructions: true,
            },
        });
        expect(prisma.agentSkill.create).toHaveBeenCalledWith({
            data: {
                visibility: "SHARED",
                scopeId: "1",
                orgId: 1,
                slug: "review",
                name: "Review",
                description: "Review risky changes.",
                instructions: "Review the change.",
                createdById: "member-1",
                updatedById: "member-1",
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
                id: "shared-skill",
                visibility: "SHARED",
                scopeId: "1",
                orgId: 1,
            },
            select: expect.any(Object),
        });
    });
});

describe("makeSharedAgentSkillPersonal", () => {
    test("moves the shared skill to personal when the user authored it", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst
            .mockResolvedValueOnce({
                id: "shared-skill",
                slug: "review",
                name: "Review",
                description: "Review risky changes.",
                instructions: "Review the change.",
                createdById: "member-1",
                autoEnrolled: false,
            });
        prisma.agentSkill.create.mockResolvedValue({
            id: "personal-skill",
            visibility: "PERSONAL",
            slug: "review",
            name: "Review",
            description: "Review risky changes.",
            instructions: "Review the change.",
            enabled: true,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        });

        const result = await makeSharedAgentSkillPersonal("shared-skill");

        expect(result).toMatchObject({
            id: "personal-skill",
            scope: "PERSONAL",
            slug: "review",
        });
        expect(prisma.agentSkill.create).toHaveBeenCalledWith({
            data: {
                visibility: "PERSONAL",
                scopeId: "member-1",
                orgId: 1,
                slug: "review",
                name: "Review",
                description: "Review risky changes.",
                instructions: "Review the change.",
                createdById: "member-1",
                updatedById: "member-1",
            },
        });
        expect(prisma.agentSkill.delete).toHaveBeenCalledWith({
            where: {
                id: "shared-skill",
            },
        });
        expect(prisma.agentSkill.findFirst).toHaveBeenCalledTimes(1);
    });

    test("copies another user's auto-enrolled shared skill and opts out of the shared command", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst
            .mockResolvedValueOnce({
                id: "shared-skill",
                slug: "review",
                name: "Review",
                description: "Review risky changes.",
                instructions: "Review the change.",
                createdById: "author-1",
                autoEnrolled: true,
            })
            .mockResolvedValueOnce({
                id: "shared-skill",
            });
        prisma.agentSkill.create.mockResolvedValue({
            id: "personal-skill",
            visibility: "PERSONAL",
            slug: "review",
            name: "Review",
            description: "Review risky changes.",
            instructions: "Review the change.",
            enabled: true,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        });

        const result = await makeSharedAgentSkillPersonal("shared-skill");

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
                    agentSkillId: "shared-skill",
                },
            },
            create: {
                orgId: 1,
                userId: "member-1",
                agentSkillId: "shared-skill",
                removedAt: expect.any(Date),
            },
            update: {
                removedAt: expect.any(Date),
            },
        });
        expect(prisma.agentSkill.findFirst).toHaveBeenCalledTimes(2);
    });

    test("returns forbidden before copying another user's unavailable shared skill", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst
            .mockResolvedValueOnce({
                id: "shared-skill",
                slug: "review",
                name: "Review",
                description: "Review risky changes.",
                instructions: "Review the change.",
                createdById: "author-1",
                autoEnrolled: false,
            })
            .mockResolvedValueOnce(null);

        const result = await makeSharedAgentSkillPersonal("shared-skill");

        expect(result).toEqual({
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
            message: "You do not have sufficient permissions to manage this skill.",
        });
        expect(prisma.agentSkill.findFirst).toHaveBeenNthCalledWith(1, {
            where: {
                id: "shared-skill",
                visibility: "SHARED",
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
                createdById: true,
                autoEnrolled: true,
            },
        });
        expect(prisma.agentSkill.findFirst).toHaveBeenNthCalledWith(2, {
            where: {
                id: "shared-skill",
                visibility: "SHARED",
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

describe("getSharedAgentSkill", () => {
    test("returns skillNotFound when the shared skill is disabled or missing", async () => {
        const prisma = setAuthContext({ role: OrgRole.OWNER });
        prisma.agentSkill.findFirst.mockResolvedValue(null);

        const result = await getSharedAgentSkill("skill-1");

        expect(result).toEqual({
            statusCode: StatusCodes.NOT_FOUND,
            errorCode: ErrorCode.AGENT_SKILL_NOT_FOUND,
            message: "Skill not found.",
        });
        expect(prisma.agentSkill.findFirst).toHaveBeenCalledWith({
            where: {
                id: "skill-1",
                visibility: "SHARED",
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

describe("deleteSharedAgentSkill", () => {
    test("returns skillNotFound when the shared skill is disabled or missing", async () => {
        const prisma = setAuthContext({ role: OrgRole.OWNER });
        prisma.agentSkill.findFirst.mockResolvedValue(null);

        const result = await deleteSharedAgentSkill("skill-1");

        expect(result).toEqual({
            statusCode: StatusCodes.NOT_FOUND,
            errorCode: ErrorCode.AGENT_SKILL_NOT_FOUND,
            message: "Skill not found.",
        });
        expect(prisma.agentSkill.findFirst).toHaveBeenCalledWith({
            where: {
                id: "skill-1",
                visibility: "SHARED",
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

    test("returns forbidden when a member deletes another author's shared skill", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst.mockResolvedValue({
            id: "skill-1",
            createdById: "author-1",
        });

        const result = await deleteSharedAgentSkill("skill-1");

        expect(result).toEqual({
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
            message: "You do not have sufficient permissions to manage this skill.",
        });
        expect(prisma.agentSkill.findFirst).toHaveBeenCalledWith({
            where: {
                id: "skill-1",
                visibility: "SHARED",
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

    test("deletes the shared skill when the author requests it", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER, userId: "author-1" });
        prisma.agentSkill.findFirst.mockResolvedValue({
            id: "skill-1",
            createdById: "author-1",
        });

        const result = await deleteSharedAgentSkill("skill-1");

        expect(result).toEqual({ success: true });
        expect(prisma.agentSkill.delete).toHaveBeenCalledWith({
            where: { id: "skill-1" },
        });
    });

    test("deletes another author's shared skill when an owner requests it", async () => {
        const prisma = setAuthContext({ role: OrgRole.OWNER });
        prisma.agentSkill.findFirst.mockResolvedValue({
            id: "skill-1",
            createdById: "author-1",
        });

        const result = await deleteSharedAgentSkill("skill-1");

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
    instructions: "Review the change.",
};

describe("updateSharedAgentSkill", () => {
    test("returns forbidden when a member updates another author's shared skill", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst.mockResolvedValue({
            id: "skill-1",
            createdById: "author-1",
        });

        const result = await updateSharedAgentSkill(validUpdateInput);

        expect(result).toEqual({
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
            message: "You do not have sufficient permissions to manage this skill.",
        });
        expect(prisma.agentSkill.findFirst).toHaveBeenCalledWith({
            where: {
                id: "skill-1",
                visibility: "SHARED",
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

    test("returns skillNotFound when the shared skill is disabled or missing", async () => {
        const prisma = setAuthContext({ role: OrgRole.OWNER });
        prisma.agentSkill.findFirst.mockResolvedValue(null);

        const result = await updateSharedAgentSkill(validUpdateInput);

        expect(result).toEqual({
            statusCode: StatusCodes.NOT_FOUND,
            errorCode: ErrorCode.AGENT_SKILL_NOT_FOUND,
            message: "Skill not found.",
        });
        expect(prisma.agentSkill.findFirst).toHaveBeenCalledWith({
            where: {
                id: "skill-1",
                visibility: "SHARED",
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

    test("updates the shared skill when the author requests it", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER, userId: "author-1" });
        prisma.agentSkill.findFirst.mockResolvedValue({
            id: "skill-1",
            createdById: "author-1",
        });
        prisma.agentSkill.update.mockResolvedValue({
            id: "skill-1",
            visibility: "SHARED",
            slug: "review",
            name: "Review",
            description: "Review risky changes.",
            instructions: "Review the change.",
            enabled: true,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        });

        const result = await updateSharedAgentSkill(validUpdateInput);

        expect(result).toMatchObject({ id: "skill-1", slug: "review" });
        expect(prisma.agentSkill.findFirst).toHaveBeenCalledWith({
            where: {
                id: "skill-1",
                visibility: "SHARED",
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
                instructions: "Review the change.",
                updatedById: "author-1",
            },
        });
    });
});

describe("adoptSharedSkill", () => {
    test("returns skillNotFound when the skill is disabled or missing, and never records adoption", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst.mockResolvedValue(null);

        const result = await adoptSharedSkill("skill-1");

        expect(result).toEqual({
            statusCode: StatusCodes.NOT_FOUND,
            errorCode: ErrorCode.AGENT_SKILL_NOT_FOUND,
            message: "Skill not found.",
        });
        // The adopt lookup requires `enabled: true`, so a disabled skill is invisible here.
        expect(prisma.agentSkill.findFirst).toHaveBeenCalledWith({
            where: {
                id: "skill-1",
                visibility: "SHARED",
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

        const result = await adoptSharedSkill("skill-1");

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

describe("unadoptSharedSkill", () => {
    test("removes the adoption against a disabled skill, since its lookup omits the enabled filter", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst.mockResolvedValue({ id: "skill-1", autoEnrolled: false });

        const result = await unadoptSharedSkill("skill-1");

        expect(result).toEqual({ success: true });
        // Unlike adopt, the unadopt lookup does NOT filter on `enabled`.
        expect(prisma.agentSkill.findFirst).toHaveBeenCalledWith({
            where: {
                id: "skill-1",
                visibility: "SHARED",
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

        const result = await unadoptSharedSkill("skill-1");

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

describe("listSharedAgentSkillManagement", () => {
    test("returns owner-management skills without requester adoption state", async () => {
        const prisma = setAuthContext({ role: OrgRole.OWNER });
        prisma.agentSkill.findMany.mockResolvedValue([{
            id: "skill-1",
            visibility: "SHARED",
            slug: "review",
            name: "Review",
            description: "Review risky changes.",
            enabled: true,
            autoEnrolled: false,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        }]);

        const result = await listSharedAgentSkillManagement();

        expect(prisma.agentSkill.findMany).toHaveBeenCalledWith({
            where: {
                visibility: "SHARED",
                scopeId: "1",
                orgId: 1,
                enabled: true,
            },
            orderBy: [
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
            scope: "SHARED",
            slug: "review",
            name: "Review",
            description: "Review risky changes.",
            enabled: true,
            autoEnrolled: false,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
        }]);
        expect(result[0]).not.toHaveProperty("isAdopted");
        expect(result[0]).not.toHaveProperty("isVisibleToUser");
        expect(result[0]).not.toHaveProperty("isCreatedByUser");
    });
});

describe("setSharedSkillFlag", () => {
    test("updates a single shared skill flag through the shared owner-gated path", async () => {
        const prisma = setAuthContext({ role: OrgRole.OWNER });
        prisma.agentSkill.findFirst.mockResolvedValue({
            id: "skill-1",
        });
        prisma.agentSkill.update.mockResolvedValue({
            id: "skill-1",
            visibility: "SHARED",
            slug: "review",
            name: "Review",
            description: "Review risky changes.",
            enabled: true,
            autoEnrolled: true,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        });

        const result = await setSharedSkillFlag({
            skillId: "skill-1",
            data: { autoEnrolled: true },
        });

        expect(prisma.agentSkill.findFirst).toHaveBeenCalledWith({
            where: {
                id: "skill-1",
                visibility: "SHARED",
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
                autoEnrolled: true,
                updatedById: "member-1",
            },
            select: expect.any(Object),
        });
        expect(result).toMatchObject({
            id: "skill-1",
            autoEnrolled: true,
        });
        expect(result).not.toHaveProperty("isAdopted");
        expect(result).not.toHaveProperty("isVisibleToUser");
        expect(result).not.toHaveProperty("isCreatedByUser");
    });

    test("rejects a non-owner through the owner gate without touching the skill", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });

        const result = await setSharedSkillFlag({
            skillId: "skill-1",
            data: { autoEnrolled: true },
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

    test("rejects updates with no flag", async () => {
        setAuthContext({ role: OrgRole.OWNER });

        const result = await setSharedSkillFlag({
            skillId: "skill-1",
            data: {},
        });

        expect(result).toMatchObject({
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.INVALID_REQUEST_BODY,
        });
        expect(mocks.checkAskEntitlement).not.toHaveBeenCalled();
    });
});
