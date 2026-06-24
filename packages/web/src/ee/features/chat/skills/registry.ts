import {
    orgAgentSkillVisibleToUserWhere,
    personalAgentSkillAuthScope,
    type Prisma,
    type PrismaClient,
} from "@sourcebot/db";
import {
    ASK_COMMAND_SOURCE_ORG_SKILL,
    ASK_COMMAND_SOURCE_PERSONAL_SKILL,
    type AskCommandDefinition,
} from "@/features/chat/commands/types";
import {
    listOrgAgentSkillCommandsForContext,
    listPersonalAgentSkillCommandsForContext,
    sourceLabelForSkillSourceId,
} from "./commandCatalog";

// The skill instructions resolved when the model invokes `load_skill`.
export interface ResolvedAutoInvocableSkill {
    id: string;
    sourceId: string;
    sourceLabel: string;
    slug: string;
    name: string;
    instructions: string;
    argumentNames: string[];
}

/**
 * Builds the auto-invocation skill catalog for a given requester. This is the
 * same catalog the manual slash-command path builds (same auth scopes, select,
 * ordering, and {@link AskCommandDefinition} shape — see commandCatalog.ts),
 * restricted to skills opted in to auto-invocation (`autoInvocableOnly`). So the
 * model can never see or load a skill the requester could not already invoke
 * manually, and the two catalogs cannot drift.
 *
 * Callers must already have authenticated; `orgId` is optional so anonymous /
 * personal-only contexts still surface personal skills.
 */
export const buildSkillRegistry = async ({
    prisma,
    userId,
    orgId,
}: {
    prisma: PrismaClient;
    userId: string;
    orgId?: number;
}): Promise<AskCommandDefinition[]> => {
    const [personalCommands, orgCommands] = await Promise.all([
        listPersonalAgentSkillCommandsForContext({ prisma, userId, autoInvocableOnly: true }),
        orgId !== undefined
            ? listOrgAgentSkillCommandsForContext({ prisma, userId, orgId, autoInvocableOnly: true })
            : Promise.resolve([] as AskCommandDefinition[]),
    ]);

    return [...personalCommands, ...orgCommands];
};

/**
 * Re-resolves a skill by id at invocation time, re-applying the auth scope and
 * the auto-invocation opt-in (defense in depth — never trusts the registry
 * snapshot). Returns null if the skill is no longer visible / opted in, so a
 * mid-stream adoption removal or de-opt-in fails closed. This mirrors the
 * auth-scoped lookup the manual pipeline performs in commandResolution.ts.
 */
export const resolveAutoInvocableSkill = async ({
    prisma,
    userId,
    orgId,
    skillId,
}: {
    prisma: PrismaClient;
    userId: string;
    orgId?: number;
    skillId: string;
}): Promise<ResolvedAutoInvocableSkill | null> => {
    const visibilityScopes: Prisma.AgentSkillWhereInput[] = [
        personalAgentSkillAuthScope(userId),
    ];
    if (orgId !== undefined) {
        visibilityScopes.push(orgAgentSkillVisibleToUserWhere(userId, orgId));
    }

    const skill = await prisma.agentSkill.findFirst({
        where: {
            id: skillId,
            enabled: true,
            autoInvocationEnabled: true,
            OR: visibilityScopes,
        },
        select: {
            id: true,
            visibility: true,
            slug: true,
            name: true,
            instructions: true,
            argumentNames: true,
        },
    });

    if (!skill) {
        return null;
    }

    const sourceId = skill.visibility === "ORG"
        ? ASK_COMMAND_SOURCE_ORG_SKILL
        : ASK_COMMAND_SOURCE_PERSONAL_SKILL;

    return {
        id: skill.id,
        sourceId,
        sourceLabel: sourceLabelForSkillSourceId(sourceId),
        slug: skill.slug,
        name: skill.name,
        instructions: skill.instructions,
        argumentNames: skill.argumentNames,
    };
};
