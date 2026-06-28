import { describe, expect, test, vi } from "vitest";
import { ASK_COMMAND_SOURCE_SHARED_SKILL, ASK_COMMAND_SOURCE_PERSONAL_SKILL } from "@/features/chat/commands/types";
import { sharedAgentSkillVisibleToUserWhere, personalAgentSkillAuthScope } from "@sourcebot/db";
import { buildSkillRegistry, resolveAutoInvocableSkill } from "./registry";

describe("buildSkillRegistry", () => {
    test("returns personal + shared skills, auth-scoped and mapped", async () => {
        const findMany = vi.fn()
            .mockResolvedValueOnce([
                { id: "p1", slug: "translate", name: "Translate", description: "Translate text" },
            ])
            .mockResolvedValueOnce([
                { id: "o1", slug: "audit", name: "Audit", description: "Audit billing" },
            ]);
        const prisma = { agentSkill: { findMany } } as never;

        const registry = await buildSkillRegistry({ prisma, userId: "user-1", orgId: 7 });

        expect(registry).toEqual([
            {
                id: "p1",
                sourceId: ASK_COMMAND_SOURCE_PERSONAL_SKILL,
                sourceLabel: "Personal",
                slug: "translate",
                name: "Translate",
                description: "Translate text",
            },
            {
                id: "o1",
                sourceId: ASK_COMMAND_SOURCE_SHARED_SKILL,
                sourceLabel: "Shared",
                slug: "audit",
                name: "Audit",
                description: "Audit billing",
            },
        ]);

        // Personal query: reuses the same auth scope as the manual pipeline. No
        // per-skill auto-invocation opt-in — every visible skill is model-invocable.
        expect(findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
            where: { ...personalAgentSkillAuthScope("user-1", 7), enabled: true },
            select: { id: true, slug: true, name: true, description: true, sourceRepoName: true },
        }));
        // Shared query: shared-visibility clause only.
        expect(findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
            where: { ...sharedAgentSkillVisibleToUserWhere("user-1", 7) },
            select: { id: true, slug: true, name: true, description: true, sourceRepoName: true },
        }));
    });
});

describe("resolveAutoInvocableSkill", () => {
    test("resolves a skill by id within auth scope and derives its source", async () => {
        const findFirst = vi.fn().mockResolvedValue({
            id: "o1",
            visibility: "SHARED",
            slug: "audit",
            name: "Audit",
            instructions: "Audit the billing system",
        });
        const prisma = { agentSkill: { findFirst } } as never;

        const result = await resolveAutoInvocableSkill({ prisma, userId: "user-1", orgId: 7, skillId: "o1" });

        expect(result).toEqual({
            id: "o1",
            sourceId: ASK_COMMAND_SOURCE_SHARED_SKILL,
            sourceLabel: "Shared",
            slug: "audit",
            name: "Audit",
            instructions: "Audit the billing system",
        });
        expect(findFirst).toHaveBeenCalledWith({
            where: {
                id: "o1",
                enabled: true,
                OR: [
                    personalAgentSkillAuthScope("user-1", 7),
                    sharedAgentSkillVisibleToUserWhere("user-1", 7),
                ],
            },
            select: {
                id: true,
                visibility: true,
                slug: true,
                name: true,
                instructions: true,
                sourceRepoName: true,
            },
        });
    });

    test("derives the personal source for a personal-visibility skill", async () => {
        const findFirst = vi.fn().mockResolvedValue({
            id: "p1",
            visibility: "PERSONAL",
            slug: "translate",
            name: "Translate",
            instructions: "Translate the text",
        });
        const prisma = { agentSkill: { findFirst } } as never;

        const result = await resolveAutoInvocableSkill({ prisma, userId: "user-1", orgId: 7, skillId: "p1" });

        expect(result).toEqual({
            id: "p1",
            sourceId: ASK_COMMAND_SOURCE_PERSONAL_SKILL,
            sourceLabel: "Personal",
            slug: "translate",
            name: "Translate",
            instructions: "Translate the text",
        });
    });

    test("does not filter on autoInvocationEnabled (forced auto-invocation parity)", async () => {
        const findFirst = vi.fn().mockResolvedValue(null);
        const prisma = { agentSkill: { findFirst } } as never;

        await resolveAutoInvocableSkill({ prisma, userId: "user-1", orgId: 7, skillId: "o1" });

        const where = findFirst.mock.calls[0][0].where;
        expect(where).not.toHaveProperty("autoInvocationEnabled");
    });

    test("fails closed (returns null) when no visible skill matches", async () => {
        const findFirst = vi.fn().mockResolvedValue(null);
        const prisma = { agentSkill: { findFirst } } as never;

        expect(await resolveAutoInvocableSkill({ prisma, userId: "u", orgId: 1, skillId: "x" })).toBeNull();
    });

    test("fails closed when the skill is synced from a repo the user can't access", async () => {
        const findFirst = vi.fn().mockResolvedValue({
            id: "o1",
            visibility: "SHARED",
            slug: "audit",
            name: "Audit",
            instructions: "Audit the billing system",
            sourceRepoName: "github.com/acme/secret",
        });
        // The user-scoped repo lookup returns nothing → repo not visible.
        const repoFindFirst = vi.fn().mockResolvedValue(null);
        const prisma = { agentSkill: { findFirst }, repo: { findFirst: repoFindFirst } } as never;

        const result = await resolveAutoInvocableSkill({ prisma, userId: "user-1", orgId: 7, skillId: "o1" });

        expect(result).toBeNull();
        expect(repoFindFirst).toHaveBeenCalledWith({
            where: { name: "github.com/acme/secret", orgId: 7 },
            select: { id: true },
        });
    });

    test("loads a synced skill when its source repo is visible to the user", async () => {
        const findFirst = vi.fn().mockResolvedValue({
            id: "o1",
            visibility: "SHARED",
            slug: "audit",
            name: "Audit",
            instructions: "Audit the billing system",
            sourceRepoName: "github.com/acme/widgets",
        });
        const repoFindFirst = vi.fn().mockResolvedValue({ id: 11 });
        const prisma = { agentSkill: { findFirst }, repo: { findFirst: repoFindFirst } } as never;

        const result = await resolveAutoInvocableSkill({ prisma, userId: "user-1", orgId: 7, skillId: "o1" });

        expect(result).toMatchObject({ id: "o1", instructions: "Audit the billing system" });
    });
});
