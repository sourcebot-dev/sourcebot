import { describe, expect, test, vi } from "vitest";
import { ASK_COMMAND_SOURCE_ORG_SKILL, ASK_COMMAND_SOURCE_PERSONAL_SKILL } from "@/features/chat/commands/types";
import { orgAgentSkillVisibleToUserWhere, personalAgentSkillAuthScope } from "@sourcebot/db";
import { buildSkillRegistry, resolveAutoInvocableSkill } from "./registry";

describe("buildSkillRegistry", () => {
    test("returns personal + org auto-invocable skills, auth-scoped and mapped", async () => {
        const findMany = vi.fn()
            .mockResolvedValueOnce([
                { id: "p1", slug: "translate", name: "Translate", description: "Translate text", instructions: "Translate to $lang", argumentNames: ["lang"] },
            ])
            .mockResolvedValueOnce([
                { id: "o1", slug: "audit", name: "Audit", description: "Audit billing", instructions: "Audit", argumentNames: [] },
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
                argumentHint: "<lang>",
            },
            {
                id: "o1",
                sourceId: ASK_COMMAND_SOURCE_ORG_SKILL,
                sourceLabel: "Workspace",
                slug: "audit",
                name: "Audit",
                description: "Audit billing",
                argumentHint: undefined,
            },
        ]);

        // Personal query: reuses the same auth scope as the manual pipeline and
        // additionally requires the auto-invocation opt-in.
        expect(findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
            where: { ...personalAgentSkillAuthScope("user-1"), enabled: true, autoInvocationEnabled: true },
        }));
        // Org query: org visibility clause + the opt-in.
        expect(findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
            where: { ...orgAgentSkillVisibleToUserWhere("user-1", 7), autoInvocationEnabled: true },
        }));
    });

    test("queries only personal skills when orgId is undefined", async () => {
        const findMany = vi.fn().mockResolvedValue([]);
        const prisma = { agentSkill: { findMany } } as never;

        const registry = await buildSkillRegistry({ prisma, userId: "user-1" });

        expect(registry).toEqual([]);
        expect(findMany).toHaveBeenCalledTimes(1);
        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { ...personalAgentSkillAuthScope("user-1"), enabled: true, autoInvocationEnabled: true },
        }));
    });
});

describe("resolveAutoInvocableSkill", () => {
    test("resolves a skill by id within auth scope and derives its source", async () => {
        const findFirst = vi.fn().mockResolvedValue({
            id: "o1",
            visibility: "ORG",
            slug: "audit",
            name: "Audit",
            instructions: "Audit $area",
            argumentNames: ["area"],
        });
        const prisma = { agentSkill: { findFirst } } as never;

        const result = await resolveAutoInvocableSkill({ prisma, userId: "user-1", orgId: 7, skillId: "o1" });

        expect(result).toEqual({
            id: "o1",
            sourceId: ASK_COMMAND_SOURCE_ORG_SKILL,
            sourceLabel: "Workspace",
            slug: "audit",
            name: "Audit",
            instructions: "Audit $area",
            argumentNames: ["area"],
        });
        expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                id: "o1",
                enabled: true,
                autoInvocationEnabled: true,
                OR: [
                    personalAgentSkillAuthScope("user-1"),
                    orgAgentSkillVisibleToUserWhere("user-1", 7),
                ],
            }),
        }));
    });

    test("fails closed (returns null) when no visible / opted-in skill matches", async () => {
        const findFirst = vi.fn().mockResolvedValue(null);
        const prisma = { agentSkill: { findFirst } } as never;

        expect(await resolveAutoInvocableSkill({ prisma, userId: "u", orgId: 1, skillId: "x" })).toBeNull();
    });

    test("scopes to personal-only when orgId is undefined", async () => {
        const findFirst = vi.fn().mockResolvedValue(null);
        const prisma = { agentSkill: { findFirst } } as never;

        await resolveAutoInvocableSkill({ prisma, userId: "u", skillId: "x" });

        expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ OR: [personalAgentSkillAuthScope("u")] }),
        }));
    });
});
