import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    authContext: undefined as unknown,
    checkAskEntitlement: vi.fn(),
    withAuth: vi.fn(),
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

// The real listing core runs against a mocked prisma so canEdit / isSynced /
// adopted derivation is exercised end-to-end through the tool.
const { listSkillsDefinition } = await import("./listSkills");

function createPrismaMock() {
    return {
        agentSkill: {
            findMany: vi.fn().mockResolvedValue([]),
        },
        repo: {
            findMany: vi.fn().mockResolvedValue([]),
        },
    };
}

const personalRow = (overrides: Record<string, unknown> = {}) => ({
    id: "personal-1",
    slug: "review",
    name: "Review",
    description: "Personal review.",
    enabled: true,
    autoEnrolled: false,
    createdById: "user-1",
    sourceRepoName: null,
    ...overrides,
});

const sharedRow = (overrides: Record<string, unknown> = {}) => ({
    id: "shared-1",
    slug: "audit",
    name: "Audit",
    description: "Shared audit.",
    enabled: true,
    autoEnrolled: false,
    createdById: "user-1",
    sourceRepoName: null,
    adoptions: [],
    ...overrides,
});

let prisma: ReturnType<typeof createPrismaMock>;

beforeEach(() => {
    vi.clearAllMocks();
    prisma = createPrismaMock();
    mocks.authContext = {
        org: { id: 1 },
        user: { id: "user-1" },
        prisma,
    };
    mocks.withAuth.mockImplementation(async (callback: (context: unknown) => unknown) => callback(mocks.authContext));
    mocks.checkAskEntitlement.mockResolvedValue(null);
});

describe("listSkillsDefinition", () => {
    test("has the expected definition flags", () => {
        expect(listSkillsDefinition.name).toBe("list_skills");
        expect(listSkillsDefinition.isReadOnly).toBe(true);
        expect(listSkillsDefinition.isIdempotent).toBe(true);
        expect(listSkillsDefinition.isDestructive).toBe(false);
    });

    test("derives canEdit / isSynced / adopted across personal and shared rows and never returns instructions", async () => {
        prisma.agentSkill.findMany
            .mockResolvedValueOnce([
                personalRow(),
                personalRow({ id: "personal-2", slug: "disabled", name: "Disabled", enabled: false }),
                personalRow({ id: "personal-3", slug: "synced", name: "Synced", sourceRepoName: "github.com/acme/widgets" }),
            ])
            .mockResolvedValueOnce([
                sharedRow({ adoptions: [{ removedAt: null }] }),
                sharedRow({ id: "shared-2", slug: "foreign", name: "Foreign", createdById: "author-2", autoEnrolled: true }),
            ]);
        prisma.repo.findMany.mockResolvedValue([{ name: "github.com/acme/widgets" }]);

        const result = await listSkillsDefinition.execute({}, { source: "sourcebot-ask-agent" });

        expect(result.metadata).toEqual({ count: 5 });
        const { skills } = JSON.parse(result.output);
        expect(skills).toEqual([
            { id: "personal-1", slug: "review", name: "Review", description: "Personal review.", scope: "personal", enabled: true, isSynced: false, canEdit: true },
            { id: "personal-2", slug: "disabled", name: "Disabled", description: "Personal review.", scope: "personal", enabled: false, isSynced: false, canEdit: false },
            { id: "personal-3", slug: "synced", name: "Synced", description: "Personal review.", scope: "personal", enabled: true, isSynced: true, canEdit: false },
            { id: "shared-1", slug: "audit", name: "Audit", description: "Shared audit.", scope: "shared", enabled: true, adopted: true, isSynced: false, canEdit: true },
            { id: "shared-2", slug: "foreign", name: "Foreign", description: "Shared audit.", scope: "shared", enabled: true, adopted: true, isSynced: false, canEdit: false },
        ]);
    });

    test("hides shared skills synced from a repo the user cannot access", async () => {
        prisma.agentSkill.findMany
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                sharedRow({ sourceRepoName: "github.com/acme/secret" }),
            ]);
        prisma.repo.findMany.mockResolvedValue([]);

        const result = await listSkillsDefinition.execute({}, { source: "sourcebot-ask-agent" });

        expect(result.metadata).toEqual({ count: 0 });
    });

    test("the scope filter limits the query to one catalog", async () => {
        prisma.agentSkill.findMany.mockResolvedValueOnce([personalRow()]);

        const result = await listSkillsDefinition.execute({ scope: "personal" }, { source: "sourcebot-ask-agent" });

        expect(prisma.agentSkill.findMany).toHaveBeenCalledTimes(1);
        expect(result.metadata).toEqual({ count: 1 });
        const { skills } = JSON.parse(result.output);
        expect(skills[0].scope).toBe("personal");
    });
});
