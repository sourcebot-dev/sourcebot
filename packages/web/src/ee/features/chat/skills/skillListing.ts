import type { AskSkillScope } from "@/lib/posthogEvents";
import { personalAgentSkillAuthScope, sharedAgentSkillAuthScope, type PrismaClient } from "@sourcebot/db";
import { agentSkillOrderBy } from "./types";
import { filterSkillsBySourceRepoAccess } from "./sourceRepoAccess";

// The read core behind the `list_skills` tool. Instructions are never included:
// `load_skill` and the `<agent_skills>` catalog carry those. Same rules as the
// mutation cores: no auth, no entitlement, no `next/cache`.

export type AgentSkillToolListItem = {
    id: string;
    slug: string;
    name: string;
    description: string;
    scope: AskSkillScope;
    enabled: boolean;
    // Shared rows only: whether the skill is active for this user (adopted or
    // auto-enrolled, and not removed).
    adopted?: boolean;
    isSynced: boolean;
    canEdit: boolean;
};

const listSkillSelect = {
    id: true,
    slug: true,
    name: true,
    description: true,
    enabled: true,
    autoEnrolled: true,
    createdById: true,
    sourceRepoName: true,
} as const;

type ListedSkillRow = {
    id: string;
    slug: string;
    name: string;
    description: string;
    enabled: boolean;
    createdById: string;
    sourceRepoName: string | null;
};

const toToolListItem = (
    skill: ListedSkillRow,
    scope: AskSkillScope,
    userId: string,
    adopted?: boolean,
): AgentSkillToolListItem => {
    const isSynced = skill.sourceRepoName !== null;
    return {
        id: skill.id,
        slug: skill.slug,
        name: skill.name,
        description: skill.description,
        scope,
        enabled: skill.enabled,
        ...(adopted !== undefined ? { adopted } : {}),
        isSynced,
        canEdit: (scope === 'personal' || skill.createdById === userId) && !isSynced && skill.enabled,
    };
};

export const listAgentSkillsForContext = async ({
    prisma,
    userId,
    orgId,
    scope,
}: {
    prisma: PrismaClient;
    userId: string;
    orgId: number;
    scope?: AskSkillScope;
}): Promise<AgentSkillToolListItem[]> => {
    const personalSkills = scope === 'shared' ? [] : await prisma.agentSkill.findMany({
        where: {
            ...personalAgentSkillAuthScope(userId, orgId),
        },
        orderBy: agentSkillOrderBy,
        select: listSkillSelect,
    });

    // The entire shared catalog, mirroring listSharedAgentSkillCatalog: enabled
    // skills only, hiding skills synced from a repo the user cannot access.
    const sharedSkills = scope === 'personal' ? [] : await (async () => {
        const skills = await prisma.agentSkill.findMany({
            where: {
                ...sharedAgentSkillAuthScope(orgId),
                enabled: true,
            },
            orderBy: agentSkillOrderBy,
            select: {
                ...listSkillSelect,
                adoptions: {
                    where: {
                        userId,
                        orgId,
                    },
                    select: {
                        removedAt: true,
                    },
                },
            },
        });

        return filterSkillsBySourceRepoAccess(skills, { prisma, orgId });
    })();

    return [
        ...personalSkills.map((skill) => toToolListItem(skill, 'personal', userId)),
        ...sharedSkills.map((skill) => {
            const isAdopted = skill.adoptions.some((adoption) => adoption.removedAt === null);
            const isRemoved = skill.adoptions.some((adoption) => adoption.removedAt !== null);
            const adopted = (skill.autoEnrolled || isAdopted) && !isRemoved;
            return toToolListItem(skill, 'shared', userId, adopted);
        }),
    ];
};
