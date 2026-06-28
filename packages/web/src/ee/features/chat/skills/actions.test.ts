import { beforeEach, describe, expect, test, vi } from "vitest";
import { CodeHostType, OrgRole } from "@sourcebot/db";
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

// actions.ts imports the git barrel for repo-source syncing; stub it so the test
// doesn't pull the server-only git chain into this (non-RSC) environment.
vi.mock("@/features/git", () => ({
    getFileSourceForRepo: vi.fn(),
    resolveFileBlobShaForRepo: vi.fn(),
}));

const {
    adoptSharedSkill,
    createSharedAgentSkill,
    deleteSharedAgentSkill,
    getAgentSkillSourceStatus,
    getSharedAgentSkill,
    listAgentSkillCommands,
    listSharedAgentSkillCatalog,
    listSharedAgentSkillManagement,
    makeSharedAgentSkillPersonal,
    publishPersonalAgentSkillToShared,
    setSharedSkillFlag,
    unadoptSharedSkill,
    updatePersonalAgentSkill,
    updatePersonalAgentSkillFromSource,
    updateSharedAgentSkill,
    updateSharedAgentSkillFromSource,
} = await import("./actions");

const gitMock = await import("@/features/git");

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
        repo: {
            findMany: vi.fn().mockResolvedValue([]),
            findFirst: vi.fn().mockResolvedValue(null),
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
                sourceRepoName: true,
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
                sourceRepoName: true,
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
                sourceRepoName: true,
                sourceFilePath: true,
                sourceRevision: true,
                sourceBlobSha: true,
                sourceImportedAt: true,
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
                sourceRepoName: true,
                sourceFilePath: true,
                sourceRevision: true,
                sourceBlobSha: true,
                sourceImportedAt: true,
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
                sourceRepoName: true,
            },
        });
    });

    test("hides a synced shared skill from a manager who can't access its source repo", async () => {
        const prisma = setAuthContext({ role: OrgRole.OWNER });
        prisma.agentSkill.findFirst
            .mockResolvedValueOnce({ id: "skill-1", createdById: "author-1", sourceRepoName: "github.com/acme/secret" })
            .mockResolvedValueOnce({
                id: "skill-1",
                visibility: "SHARED",
                slug: "audit",
                name: "Audit",
                description: "Audit",
                instructions: "Audit the billing system",
                enabled: true,
                sourceRepoName: "github.com/acme/secret",
                sourceFilePath: "docs/skill.md",
                sourceRevision: "main",
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                updatedAt: new Date("2026-01-02T00:00:00.000Z"),
            });
        prisma.repo.findFirst.mockResolvedValue(null);

        const result = await getSharedAgentSkill("skill-1");

        expect(result).toMatchObject({ errorCode: ErrorCode.AGENT_SKILL_NOT_FOUND });
        expect(prisma.repo.findFirst).toHaveBeenCalledWith({
            where: { name: "github.com/acme/secret", orgId: 1 },
            select: { id: true },
        });
    });
});

describe("listSharedAgentSkillCatalog", () => {
    const catalogRow = (id: string, sourceRepoName: string | null) => ({
        id,
        visibility: "SHARED" as const,
        slug: id,
        name: id,
        description: "",
        instructions: "Do the thing.",
        enabled: true,
        autoEnrolled: true,
        createdById: "member-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        sourceRepoName,
        sourceFilePath: sourceRepoName ? "docs/skill.md" : null,
        sourceRevision: sourceRepoName ? "main" : null,
        adoptions: [],
        createdBy: { email: "member@sourcebot.dev" },
    });

    test("drops synced skills whose source repo the user can't access, keeping plain and accessible ones", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findMany.mockResolvedValue([
            catalogRow("plain", null),
            catalogRow("visible", "github.com/acme/widgets"),
            catalogRow("hidden", "github.com/acme/secret"),
        ]);
        // Only widgets resolves through the user-scoped repo lookup.
        prisma.repo.findMany.mockResolvedValue([{ name: "github.com/acme/widgets" }]);

        const result = await listSharedAgentSkillCatalog();

        if (!Array.isArray(result)) {
            throw new Error("Expected catalog skills.");
        }
        expect(result.map((skill) => skill.id)).toEqual(["plain", "visible"]);
        expect(prisma.repo.findMany).toHaveBeenCalledWith({
            where: { name: { in: ["github.com/acme/widgets", "github.com/acme/secret"] }, orgId: 1 },
            select: { name: true },
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
                sourceRepoName: true,
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
                sourceRepoName: true,
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
                sourceRepoName: true,
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
                sourceRepoName: true,
            },
        });
        expect(prisma.agentSkill.update).not.toHaveBeenCalled();
    });

    test("updates the shared skill when the author requests it", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER, userId: "author-1" });
        prisma.agentSkill.findFirst.mockResolvedValue({
            id: "skill-1",
            createdById: "author-1",
            sourceRepoName: null,
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
                sourceRepoName: true,
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

    test("writes only name and command for a repo-synced shared skill", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER, userId: "author-1" });
        prisma.agentSkill.findFirst.mockResolvedValue({
            id: "skill-1",
            createdById: "author-1",
            sourceRepoName: "github.com/acme/widgets",
        });
        prisma.agentSkill.update.mockResolvedValue({
            id: "skill-1",
            visibility: "SHARED",
            slug: "renamed",
            name: "Renamed",
            description: "kept from source",
            instructions: "kept body from source",
            enabled: true,
            sourceRepoName: "github.com/acme/widgets",
            sourceFilePath: "docs/skill.md",
            sourceRevision: "main",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        });

        const result = await updateSharedAgentSkill({
            id: "skill-1",
            name: "Renamed",
            slug: "renamed",
            description: "attempted description change",
            instructions: "attempted instruction change that is long enough",
        });

        const updateArg = prisma.agentSkill.update.mock.calls[0][0];
        expect(updateArg.data).toMatchObject({ name: "Renamed", slug: "renamed" });
        // A synced shared skill's content tracks the source file, so the client's
        // description/instructions are ignored here.
        expect(updateArg.data.description).toBeUndefined();
        expect(updateArg.data.instructions).toBeUndefined();
        expect(result).toMatchObject({ id: "skill-1", slug: "renamed", source: { repoName: "github.com/acme/widgets" } });
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
                sourceRepoName: true,
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

    test("rejects adopting a skill synced from a repo the user can't access", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst.mockResolvedValue({ id: "skill-1", sourceRepoName: "github.com/acme/secret" });
        prisma.repo.findFirst.mockResolvedValue(null);

        const result = await adoptSharedSkill("skill-1");

        expect(result).toMatchObject({ errorCode: ErrorCode.AGENT_SKILL_NOT_FOUND });
        expect(prisma.repo.findFirst).toHaveBeenCalledWith({
            where: { name: "github.com/acme/secret", orgId: 1 },
            select: { id: true },
        });
        expect(prisma.agentSkillAdoption.upsert).not.toHaveBeenCalled();
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

describe("getAgentSkillSourceStatus", () => {
    const syncedRow = {
        sourceRepoName: "github.com/acme/widgets",
        sourceFilePath: "docs/skill.md",
        sourceRevision: "main",
        sourceBlobSha: "old-sha",
    };

    test("returns in_sync when the indexed blob matches the imported one", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst.mockResolvedValue(syncedRow);
        vi.mocked(gitMock.resolveFileBlobShaForRepo).mockResolvedValue("old-sha");

        const result = await getAgentSkillSourceStatus("skill-1");

        expect(result).toEqual({ status: "in_sync" });
        expect(gitMock.resolveFileBlobShaForRepo).toHaveBeenCalledWith(
            { path: "docs/skill.md", repo: "github.com/acme/widgets", ref: "main" },
            expect.objectContaining({ org: { id: 1 } }),
        );
    });

    test("returns update_available when the indexed blob has moved on", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst.mockResolvedValue(syncedRow);
        vi.mocked(gitMock.resolveFileBlobShaForRepo).mockResolvedValue("new-sha");

        expect(await getAgentSkillSourceStatus("skill-1")).toEqual({ status: "update_available" });
    });

    test("returns not_synced when the skill has no source", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst.mockResolvedValue({
            sourceRepoName: null,
            sourceFilePath: null,
            sourceRevision: null,
            sourceBlobSha: null,
        });

        expect(await getAgentSkillSourceStatus("skill-1")).toEqual({ status: "not_synced" });
        expect(gitMock.resolveFileBlobShaForRepo).not.toHaveBeenCalled();
    });

    test("degrades a missing repo to repo_unavailable and a missing file to source_missing", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst.mockResolvedValue(syncedRow);

        vi.mocked(gitMock.resolveFileBlobShaForRepo).mockResolvedValue({
            statusCode: StatusCodes.NOT_FOUND,
            errorCode: ErrorCode.NOT_FOUND,
            message: "Repository not found.",
        });
        expect(await getAgentSkillSourceStatus("skill-1")).toEqual({ status: "repo_unavailable" });

        vi.mocked(gitMock.resolveFileBlobShaForRepo).mockResolvedValue({
            statusCode: StatusCodes.NOT_FOUND,
            errorCode: ErrorCode.FILE_NOT_FOUND,
            message: "File not found.",
        });
        expect(await getAgentSkillSourceStatus("skill-1")).toEqual({ status: "source_missing" });
    });

    test("returns not found for a skill the user does not own", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst.mockResolvedValue(null);

        expect(await getAgentSkillSourceStatus("skill-1")).toMatchObject({
            errorCode: ErrorCode.AGENT_SKILL_NOT_FOUND,
        });
    });

    test("looks the skill up across the caller's personal scope or any enabled shared skill", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst.mockResolvedValue(syncedRow);
        vi.mocked(gitMock.resolveFileBlobShaForRepo).mockResolvedValue("old-sha");

        await getAgentSkillSourceStatus("skill-1");

        expect(prisma.agentSkill.findFirst).toHaveBeenCalledWith({
            where: {
                id: "skill-1",
                OR: [
                    {
                        visibility: "PERSONAL",
                        scopeId: "member-1",
                        orgId: 1,
                        createdById: "member-1",
                    },
                    {
                        visibility: "SHARED",
                        scopeId: "1",
                        orgId: 1,
                        enabled: true,
                    },
                ],
            },
            select: {
                sourceRepoName: true,
                sourceFilePath: true,
                sourceRevision: true,
                sourceBlobSha: true,
            },
        });
    });
});

describe("updatePersonalAgentSkill", () => {
    test("writes only name and command for a repo-synced skill, leaving content synced", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst.mockResolvedValue({ id: "skill-1", sourceRepoName: "github.com/acme/widgets" });
        prisma.agentSkill.update.mockResolvedValue({
            id: "skill-1",
            visibility: "PERSONAL",
            slug: "renamed",
            name: "Renamed",
            description: "kept from source",
            instructions: "kept body from source",
            enabled: true,
            sourceRepoName: "github.com/acme/widgets",
            sourceFilePath: "docs/skill.md",
            sourceRevision: "main",
            createdAt: new Date("2026-06-20T00:00:00.000Z"),
            updatedAt: new Date("2026-06-25T00:00:00.000Z"),
        });

        const result = await updatePersonalAgentSkill({
            id: "skill-1",
            name: "Renamed",
            slug: "renamed",
            description: "attempted description change",
            instructions: "attempted instruction change that is long enough",
        });

        const updateArg = prisma.agentSkill.update.mock.calls[0][0];
        expect(updateArg.data).toMatchObject({ name: "Renamed", slug: "renamed" });
        // Content fields are not written for synced skills, even if sent by the client.
        expect(updateArg.data.description).toBeUndefined();
        expect(updateArg.data.instructions).toBeUndefined();
        expect(result).toMatchObject({ id: "skill-1", slug: "renamed", source: { repoName: "github.com/acme/widgets" } });
    });

    test("writes all fields for a non-synced skill", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst.mockResolvedValue({ id: "skill-1", sourceRepoName: null });
        prisma.agentSkill.update.mockResolvedValue({
            id: "skill-1",
            visibility: "PERSONAL",
            slug: "manual",
            name: "Manual",
            description: "Edited description",
            instructions: "Edited instructions long enough",
            enabled: true,
            sourceRepoName: null,
            sourceFilePath: null,
            sourceRevision: null,
            createdAt: new Date("2026-06-20T00:00:00.000Z"),
            updatedAt: new Date("2026-06-25T00:00:00.000Z"),
        });

        await updatePersonalAgentSkill({
            id: "skill-1",
            name: "Manual",
            slug: "manual",
            description: "Edited description",
            instructions: "Edited instructions long enough",
        });

        const updateArg = prisma.agentSkill.update.mock.calls[0][0];
        expect(updateArg.data).toMatchObject({
            name: "Manual",
            slug: "manual",
            description: "Edited description",
            instructions: "Edited instructions long enough",
        });
    });
});

describe("updatePersonalAgentSkillFromSource", () => {
    test("refreshes synced content and blob OID, preserving the local name and command", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst.mockResolvedValue({
            id: "skill-1",
            name: "My Deploy",
            slug: "my-deploy",
            sourceRepoName: "github.com/acme/widgets",
            sourceFilePath: "docs/skill.md",
            sourceRevision: "main",
        });
        // The file's front matter has a different name; it must NOT overwrite the
        // user's local name/command — only description + instructions are pulled.
        vi.mocked(gitMock.getFileSourceForRepo).mockResolvedValue({
            source: "---\nname: Upstream Name\ndescription: New steps\n---\n\nRun the new deploy script.",
            language: "Markdown",
            path: "docs/skill.md",
            repo: "github.com/acme/widgets",
            repoCodeHostType: CodeHostType.github,
            webUrl: "https://sourcebot.example.com/browse",
            blobSha: "new-sha",
        });
        prisma.agentSkill.update.mockResolvedValue({
            id: "skill-1",
            visibility: "PERSONAL",
            slug: "my-deploy",
            name: "My Deploy",
            description: "New steps",
            instructions: "Run the new deploy script.",
            enabled: true,
            sourceRepoName: "github.com/acme/widgets",
            sourceFilePath: "docs/skill.md",
            sourceRevision: "main",
            createdAt: new Date("2026-06-20T00:00:00.000Z"),
            updatedAt: new Date("2026-06-25T00:00:00.000Z"),
        });

        const result = await updatePersonalAgentSkillFromSource("skill-1");

        const updateArg = prisma.agentSkill.update.mock.calls[0][0];
        expect(updateArg.where).toEqual({ id: "skill-1" });
        expect(updateArg.data).toMatchObject({
            description: "New steps",
            instructions: "Run the new deploy script.",
            sourceBlobSha: "new-sha",
        });
        // name and command are local labels and are left untouched by a sync.
        expect(updateArg.data.name).toBeUndefined();
        expect(updateArg.data.slug).toBeUndefined();
        expect(result).toMatchObject({
            id: "skill-1",
            name: "My Deploy",
            slug: "my-deploy",
            source: { repoName: "github.com/acme/widgets", filePath: "docs/skill.md", revision: "main" },
        });
    });

    test("rejects when the skill is not linked to a repository source", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst.mockResolvedValue({
            id: "skill-1",
            slug: "manual",
            sourceRepoName: null,
            sourceFilePath: null,
            sourceRevision: null,
        });

        const result = await updatePersonalAgentSkillFromSource("skill-1");

        expect(result).toMatchObject({ errorCode: ErrorCode.INVALID_REQUEST_BODY });
        expect(gitMock.getFileSourceForRepo).not.toHaveBeenCalled();
        expect(prisma.agentSkill.update).not.toHaveBeenCalled();
    });

    test("surfaces a source-fetch error without writing", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst.mockResolvedValue({
            id: "skill-1",
            slug: "deploy-widgets",
            sourceRepoName: "github.com/acme/widgets",
            sourceFilePath: "docs/skill.md",
            sourceRevision: "main",
        });
        vi.mocked(gitMock.getFileSourceForRepo).mockResolvedValue({
            statusCode: StatusCodes.NOT_FOUND,
            errorCode: ErrorCode.FILE_NOT_FOUND,
            message: "File not found.",
        });

        const result = await updatePersonalAgentSkillFromSource("skill-1");

        expect(result).toMatchObject({ errorCode: ErrorCode.FILE_NOT_FOUND });
        expect(prisma.agentSkill.update).not.toHaveBeenCalled();
    });
});

describe("updateSharedAgentSkillFromSource", () => {
    const importedAt = new Date("2026-06-20T00:00:00.000Z");

    test("refreshes a synced shared skill's content for its author, preserving local name and command", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER, userId: "author-1" });
        prisma.agentSkill.findFirst
            .mockResolvedValueOnce({
                id: "shared-skill",
                createdById: "author-1",
                sourceRepoName: "github.com/acme/widgets",
            })
            .mockResolvedValueOnce({
                id: "shared-skill",
                name: "Team Deploy",
                slug: "team-deploy",
                sourceRepoName: "github.com/acme/widgets",
                sourceFilePath: "docs/skill.md",
                sourceRevision: "main",
            });
        vi.mocked(gitMock.getFileSourceForRepo).mockResolvedValue({
            source: "---\nname: Upstream Name\ndescription: New steps\n---\n\nRun the new deploy script.",
            language: "Markdown",
            path: "docs/skill.md",
            repo: "github.com/acme/widgets",
            repoCodeHostType: CodeHostType.github,
            webUrl: "https://sourcebot.example.com/browse",
            blobSha: "new-sha",
        });
        prisma.agentSkill.update.mockResolvedValue({
            id: "shared-skill",
            visibility: "SHARED",
            slug: "team-deploy",
            name: "Team Deploy",
            description: "New steps",
            instructions: "Run the new deploy script.",
            enabled: true,
            autoEnrolled: false,
            createdById: "author-1",
            sourceRepoName: "github.com/acme/widgets",
            sourceFilePath: "docs/skill.md",
            sourceRevision: "main",
            createdAt: new Date("2026-06-18T00:00:00.000Z"),
            updatedAt: new Date("2026-06-25T00:00:00.000Z"),
            adoptions: [{ id: "adoption-1", removedAt: null }],
            createdBy: { email: "author@sourcebot.dev" },
        });

        const result = await updateSharedAgentSkillFromSource("shared-skill");

        const updateArg = prisma.agentSkill.update.mock.calls[0][0];
        expect(updateArg.data).toMatchObject({
            description: "New steps",
            instructions: "Run the new deploy script.",
            sourceBlobSha: "new-sha",
        });
        // A sync never overwrites the local label or command.
        expect(updateArg.data.name).toBeUndefined();
        expect(updateArg.data.slug).toBeUndefined();
        expect(result).toMatchObject({
            id: "shared-skill",
            scope: "SHARED",
            name: "Team Deploy",
            slug: "team-deploy",
            isCreatedByUser: true,
            source: { repoName: "github.com/acme/widgets", filePath: "docs/skill.md", revision: "main" },
        });
    });

    test("rejects a member who cannot manage the shared skill, without fetching the source", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER, userId: "member-1" });
        prisma.agentSkill.findFirst.mockResolvedValue({
            id: "shared-skill",
            createdById: "author-1",
            sourceRepoName: "github.com/acme/widgets",
        });

        const result = await updateSharedAgentSkillFromSource("shared-skill");

        expect(result).toEqual({
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
            message: "You do not have sufficient permissions to manage this skill.",
        });
        expect(gitMock.getFileSourceForRepo).not.toHaveBeenCalled();
        expect(prisma.agentSkill.update).not.toHaveBeenCalled();
    });

    test("rejects when the shared skill is not linked to a repository source", async () => {
        const prisma = setAuthContext({ role: OrgRole.OWNER });
        prisma.agentSkill.findFirst
            .mockResolvedValueOnce({
                id: "shared-skill",
                createdById: "author-1",
                sourceRepoName: null,
            })
            .mockResolvedValueOnce({
                id: "shared-skill",
                name: "Manual",
                slug: "manual",
                sourceRepoName: null,
                sourceFilePath: null,
                sourceRevision: null,
            });

        const result = await updateSharedAgentSkillFromSource("shared-skill");

        expect(result).toMatchObject({ errorCode: ErrorCode.INVALID_REQUEST_BODY });
        expect(gitMock.getFileSourceForRepo).not.toHaveBeenCalled();
        expect(prisma.agentSkill.update).not.toHaveBeenCalled();
    });

    test("carries the source link onto the shared skill when publishing a synced personal skill", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst
            .mockResolvedValueOnce({
                slug: "deploy-widgets",
                name: "Deploy Widgets",
                description: "Deploy steps",
                instructions: "Run the deploy script.",
                sourceRepoName: "github.com/acme/widgets",
                sourceFilePath: "docs/skill.md",
                sourceRevision: "main",
                sourceBlobSha: "blob-1",
                sourceImportedAt: importedAt,
            })
            .mockResolvedValueOnce({
                id: "shared-skill",
                visibility: "SHARED",
                slug: "deploy-widgets",
                name: "Deploy Widgets",
                description: "Deploy steps",
                instructions: "Run the deploy script.",
                enabled: true,
                autoEnrolled: false,
                createdById: "member-1",
                createdAt: new Date("2026-06-18T00:00:00.000Z"),
                updatedAt: new Date("2026-06-19T00:00:00.000Z"),
                sourceRepoName: "github.com/acme/widgets",
                sourceFilePath: "docs/skill.md",
                sourceRevision: "main",
                adoptions: [{ id: "adoption-1", removedAt: null }],
                createdBy: { email: "member@sourcebot.dev" },
            });
        prisma.agentSkill.create.mockResolvedValue({ id: "shared-skill" });

        const result = await publishPersonalAgentSkillToShared("personal-skill");

        const createArg = prisma.agentSkill.create.mock.calls[0][0];
        expect(createArg.data).toMatchObject({
            sourceRepoName: "github.com/acme/widgets",
            sourceFilePath: "docs/skill.md",
            sourceRevision: "main",
            sourceBlobSha: "blob-1",
            sourceImportedAt: importedAt,
        });
        expect(result).toMatchObject({
            id: "shared-skill",
            source: { repoName: "github.com/acme/widgets", filePath: "docs/skill.md", revision: "main" },
        });
    });

    test("carries the source link back to personal when a synced shared skill is made personal", async () => {
        const prisma = setAuthContext({ role: OrgRole.MEMBER });
        prisma.agentSkill.findFirst.mockResolvedValueOnce({
            id: "shared-skill",
            slug: "deploy-widgets",
            name: "Deploy Widgets",
            description: "Deploy steps",
            instructions: "Run the deploy script.",
            createdById: "member-1",
            autoEnrolled: false,
            sourceRepoName: "github.com/acme/widgets",
            sourceFilePath: "docs/skill.md",
            sourceRevision: "main",
            sourceBlobSha: "blob-1",
            sourceImportedAt: importedAt,
        });
        prisma.agentSkill.create.mockResolvedValue({
            id: "personal-skill",
            visibility: "PERSONAL",
            slug: "deploy-widgets",
            name: "Deploy Widgets",
            description: "Deploy steps",
            instructions: "Run the deploy script.",
            enabled: true,
            sourceRepoName: "github.com/acme/widgets",
            sourceFilePath: "docs/skill.md",
            sourceRevision: "main",
            createdAt: new Date("2026-06-18T00:00:00.000Z"),
            updatedAt: new Date("2026-06-19T00:00:00.000Z"),
        });

        const result = await makeSharedAgentSkillPersonal("shared-skill");

        const createArg = prisma.agentSkill.create.mock.calls[0][0];
        expect(createArg.data).toMatchObject({
            sourceRepoName: "github.com/acme/widgets",
            sourceFilePath: "docs/skill.md",
            sourceRevision: "main",
            sourceBlobSha: "blob-1",
            sourceImportedAt: importedAt,
        });
        expect(result).toMatchObject({
            id: "personal-skill",
            scope: "PERSONAL",
            source: { repoName: "github.com/acme/widgets", filePath: "docs/skill.md", revision: "main" },
        });
    });
});
