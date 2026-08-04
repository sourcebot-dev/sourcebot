import { describe, expect, test, vi } from "vitest";
import { canAccessSkillSource, filterSkillsBySourceRepoAccess } from "./sourceRepoAccess";

describe("filterSkillsBySourceRepoAccess", () => {
    test("keeps non-synced skills and resolves no repos when nothing is synced", async () => {
        const findMany = vi.fn();
        const prisma = { repo: { findMany } } as never;

        const skills = [
            { id: "a", sourceRepoName: null },
            { id: "b", sourceRepoName: null },
        ];

        expect(await filterSkillsBySourceRepoAccess(skills, { prisma, orgId: 1 })).toEqual(skills);
        // Short-circuits: no repo lookup when there are no synced skills.
        expect(findMany).not.toHaveBeenCalled();
    });

    test("keeps a synced skill only when its source repo resolves for the user", async () => {
        // The user-scoped prisma applies the repo permission filter, so only the
        // repos the user can see come back. Here: widgets is visible, secret is not.
        const findMany = vi.fn().mockResolvedValue([{ name: "github.com/acme/widgets" }]);
        const prisma = { repo: { findMany } } as never;

        const skills = [
            { id: "plain", sourceRepoName: null },
            { id: "visible", sourceRepoName: "github.com/acme/widgets" },
            { id: "hidden", sourceRepoName: "github.com/acme/secret" },
        ];

        const result = await filterSkillsBySourceRepoAccess(skills, { prisma, orgId: 7 });

        expect(result.map((skill) => skill.id)).toEqual(["plain", "visible"]);
        // One batched lookup over the distinct referenced repo names.
        expect(findMany).toHaveBeenCalledWith({
            where: { name: { in: ["github.com/acme/widgets", "github.com/acme/secret"] }, orgId: 7 },
            select: { name: true },
        });
    });

    test("is a no-op when every referenced repo resolves (e.g. permission syncing off)", async () => {
        // With PERMISSION_SYNC_ENABLED off the repo query carries no filter, so every
        // referenced repo comes back and nothing is dropped.
        const findMany = vi.fn().mockResolvedValue([
            { name: "github.com/acme/widgets" },
            { name: "github.com/acme/secret" },
        ]);
        const prisma = { repo: { findMany } } as never;

        const skills = [
            { id: "visible", sourceRepoName: "github.com/acme/widgets" },
            { id: "also-visible", sourceRepoName: "github.com/acme/secret" },
        ];

        const result = await filterSkillsBySourceRepoAccess(skills, { prisma, orgId: 7 });

        expect(result.map((skill) => skill.id)).toEqual(["visible", "also-visible"]);
    });
});

describe("canAccessSkillSource", () => {
    test("allows a skill with no source without a repo lookup", async () => {
        const findFirst = vi.fn();
        const prisma = { repo: { findFirst } } as never;

        expect(await canAccessSkillSource({ sourceRepoName: null }, { prisma, orgId: 1 })).toBe(true);
        expect(findFirst).not.toHaveBeenCalled();
    });

    test("allows a synced skill when its source repo resolves", async () => {
        const findFirst = vi.fn().mockResolvedValue({ id: 9 });
        const prisma = { repo: { findFirst } } as never;

        expect(await canAccessSkillSource({ sourceRepoName: "github.com/acme/widgets" }, { prisma, orgId: 3 })).toBe(true);
        expect(findFirst).toHaveBeenCalledWith({
            where: { name: "github.com/acme/widgets", orgId: 3 },
            select: { id: true },
        });
    });

    test("denies a synced skill when its source repo does not resolve", async () => {
        const findFirst = vi.fn().mockResolvedValue(null);
        const prisma = { repo: { findFirst } } as never;

        expect(await canAccessSkillSource({ sourceRepoName: "github.com/acme/secret" }, { prisma, orgId: 3 })).toBe(false);
    });
});
