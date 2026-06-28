import {
    sharedAgentSkillVisibleToUserWhere,
    personalAgentSkillAuthScope,
    type Prisma,
    type PrismaClient,
} from "@sourcebot/db";
import {
    ASK_COMMAND_SOURCE_SHARED_SKILL,
    ASK_COMMAND_SOURCE_PERSONAL_SKILL,
    type AskCommandDefinition,
} from "@/features/chat/commands/types";
import {
    listSharedAgentSkillCommandsForContext,
    listPersonalAgentSkillCommandsForContext,
    sourceLabelForSkillSourceId,
} from "./commandCatalog";
import { canAccessSkillSource } from "./sourceRepoAccess";

// The skill instructions resolved when the model invokes `load_skill`.
export interface ResolvedAutoInvocableSkill {
    id: string;
    sourceId: string;
    sourceLabel: string;
    slug: string;
    name: string;
    instructions: string;
}

/**
 * Builds the skill catalog the model sees for a given requester. This is the
 * same catalog the manual slash-command path builds (same auth scopes, select,
 * ordering, and {@link AskCommandDefinition} shape — see commandCatalog.ts), so
 * the model can never see or load a skill the requester could not already invoke
 * manually, and the two catalogs cannot drift. Every available skill is
 * model-invocable — there is no per-skill opt-in.
 *
 * Both legs require an org: personal skills are scoped to the (user, org) pair,
 * and shared skills are org-owned.
 */
export const buildSkillRegistry = async ({
    prisma,
    userId,
    orgId,
}: {
    prisma: PrismaClient;
    userId: string;
    orgId: number;
}): Promise<AskCommandDefinition[]> => {
    const [personalCommands, sharedCommands] = await Promise.all([
        listPersonalAgentSkillCommandsForContext({ prisma, userId, orgId }),
        listSharedAgentSkillCommandsForContext({ prisma, userId, orgId }),
    ]);

    return [...personalCommands, ...sharedCommands];
};

/**
 * Re-resolves a skill by id at invocation time, re-applying the auth scope
 * (defense in depth — never trusts the registry snapshot). Returns null if the
 * skill is no longer visible, so a mid-stream adoption removal fails closed.
 * This mirrors the auth-scoped lookup the manual pipeline performs in
 * commandResolution.ts.
 */
export const resolveAutoInvocableSkill = async ({
    prisma,
    userId,
    orgId,
    skillId,
}: {
    prisma: PrismaClient;
    userId: string;
    orgId: number;
    skillId: string;
}): Promise<ResolvedAutoInvocableSkill | null> => {
    const visibilityScopes: Prisma.AgentSkillWhereInput[] = [
        personalAgentSkillAuthScope(userId, orgId),
        sharedAgentSkillVisibleToUserWhere(userId, orgId),
    ];

    const skill = await prisma.agentSkill.findFirst({
        where: {
            id: skillId,
            enabled: true,
            OR: visibilityScopes,
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

    if (!skill) {
        return null;
    }

    // A skill synced from a repo is only loadable by users who can access that
    // repo. Fails closed (returns null, as for an unscoped/removed skill) so the
    // model cannot load instructions mirrored from a repo the user can't see.
    if (!(await canAccessSkillSource(skill, { prisma, orgId }))) {
        return null;
    }

    const sourceId = skill.visibility === "SHARED"
        ? ASK_COMMAND_SOURCE_SHARED_SKILL
        : ASK_COMMAND_SOURCE_PERSONAL_SKILL;

    return {
        id: skill.id,
        sourceId,
        sourceLabel: sourceLabelForSkillSourceId(sourceId),
        slug: skill.slug,
        name: skill.name,
        instructions: skill.instructions,
    };
};
