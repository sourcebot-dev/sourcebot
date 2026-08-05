import type { PrismaClient } from "@sourcebot/db";

// Permission gate for skills imported from a repository file. A synced skill
// (sourceRepoName !== null) mirrors content from an indexed repo, so it must only
// be exposed to users who can access that repo. Visibility is resolved by querying
// the `repo` table through the *user-scoped* prisma, which injects the same repo
// permission filter that gates file reads (see getRepoPermissionFilterForUser).
// Two consequences fall out for free:
//   - it is a no-op when PERMISSION_SYNC_ENABLED is off (every repo resolves), and
//   - a repo the user cannot see, or that no longer exists, both resolve to "no
//     access", so an orphaned source fails closed.
// Skills with no source are always allowed.

const distinctSourceRepoNames = (skills: { sourceRepoName: string | null }[]): string[] =>
    [...new Set(
        skills
            .map((skill) => skill.sourceRepoName)
            .filter((name): name is string => typeof name === "string" && name.length > 0),
    )];

// Returns the subset of skills the requester may see: any skill without a source,
// plus synced skills whose source repo is visible to the user. The referenced-repo
// set is resolved in a single batched query, so this is one extra `repo` read per
// list (skipped entirely when no skill is synced).
export const filterSkillsBySourceRepoAccess = async <T extends { sourceRepoName: string | null }>(
    skills: T[],
    { prisma, orgId }: { prisma: PrismaClient; orgId: number },
): Promise<T[]> => {
    const repoNames = distinctSourceRepoNames(skills);
    if (repoNames.length === 0) {
        return skills;
    }

    const visibleRepos = await prisma.repo.findMany({
        where: { name: { in: repoNames }, orgId },
        select: { name: true },
    });
    const visibleRepoNames = new Set(visibleRepos.map((repo) => repo.name));

    return skills.filter(
        (skill) => !skill.sourceRepoName || visibleRepoNames.has(skill.sourceRepoName),
    );
};

// Single-skill form of the gate, for the auto-invocation resolver and per-skill
// fetches where one skill is loaded by id.
export const canAccessSkillSource = async (
    skill: { sourceRepoName: string | null },
    { prisma, orgId }: { prisma: PrismaClient; orgId: number },
): Promise<boolean> => {
    if (!skill.sourceRepoName) {
        return true;
    }

    const repo = await prisma.repo.findFirst({
        where: { name: skill.sourceRepoName, orgId },
        select: { id: true },
    });

    return repo !== null;
};
