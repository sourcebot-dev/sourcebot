import {
    orgAgentSkillVisibleToUserWhere,
    personalAgentSkillAuthScope,
    type Prisma,
    type PrismaClient,
} from "@sourcebot/db";
import { getArgumentHint } from "@/features/chat/commands/argumentSubstitution";
import {
    ASK_COMMAND_SOURCE_ORG_SKILL,
    ASK_COMMAND_SOURCE_PERSONAL_SKILL,
    type AskCommandDefinition,
} from "@/features/chat/commands/types";
import { agentSkillOrderBy } from "./types";

// Display labels for where a skill command originates. Shared by the manual
// slash-command catalog (the listAgentSkillCommands actions) and the
// auto-invocation catalog (buildSkillRegistry) so both surface a skill's source
// identically.
export const PERSONAL_SKILL_SOURCE_LABEL = "Personal";
export const ORG_SKILL_SOURCE_LABEL = "Workspace";

export const sourceLabelForSkillSourceId = (sourceId: string): string =>
    sourceId === ASK_COMMAND_SOURCE_ORG_SKILL ? ORG_SKILL_SOURCE_LABEL : PERSONAL_SKILL_SOURCE_LABEL;

// The minimal columns needed to build an AskCommandDefinition. `instructions`
// is selected only to derive the argument hint; it is never surfaced in the
// catalog itself (which the model sees) — instructions are loaded on demand.
const agentSkillCommandSelect = {
    id: true,
    slug: true,
    name: true,
    description: true,
    instructions: true,
    argumentNames: true,
} satisfies Prisma.AgentSkillSelect;

type AgentSkillCommandRow = {
    id: string;
    slug: string;
    name: string;
    description: string;
    instructions: string;
    argumentNames: string[];
};

export const toAskCommandDefinition = (
    skill: AgentSkillCommandRow,
    sourceId: string,
    sourceLabel: string,
): AskCommandDefinition => ({
    id: skill.id,
    sourceId,
    sourceLabel,
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    argumentHint: getArgumentHint(skill.instructions, skill.argumentNames),
});

/**
 * Lists the requester's personal skills as slash-command definitions, applying
 * the shared personal auth scope. `autoInvocableOnly` additionally restricts to
 * skills opted in to model auto-invocation — the single difference between the
 * manual and auto catalogs. Both paths share this query, select, ordering, and
 * mapping so they can never drift.
 */
export const listPersonalAgentSkillCommandsForContext = async ({
    prisma,
    userId,
    autoInvocableOnly = false,
}: {
    prisma: PrismaClient;
    userId: string;
    autoInvocableOnly?: boolean;
}): Promise<AskCommandDefinition[]> => {
    const skills = await prisma.agentSkill.findMany({
        where: {
            ...personalAgentSkillAuthScope(userId),
            enabled: true,
            ...(autoInvocableOnly ? { autoInvocationEnabled: true } : {}),
        },
        orderBy: agentSkillOrderBy,
        select: agentSkillCommandSelect,
    });

    return skills.map((skill) => toAskCommandDefinition(
        skill,
        ASK_COMMAND_SOURCE_PERSONAL_SKILL,
        PERSONAL_SKILL_SOURCE_LABEL,
    ));
};

/**
 * Lists the org skills visible to the requester as slash-command definitions,
 * applying the shared org-visibility clause (enabled + adopted/auto-enrolled +
 * not-removed). `autoInvocableOnly` additionally restricts to skills opted in to
 * model auto-invocation. See {@link listPersonalAgentSkillCommandsForContext}.
 */
export const listOrgAgentSkillCommandsForContext = async ({
    prisma,
    userId,
    orgId,
    autoInvocableOnly = false,
}: {
    prisma: PrismaClient;
    userId: string;
    orgId: number;
    autoInvocableOnly?: boolean;
}): Promise<AskCommandDefinition[]> => {
    const skills = await prisma.agentSkill.findMany({
        where: {
            ...orgAgentSkillVisibleToUserWhere(userId, orgId),
            ...(autoInvocableOnly ? { autoInvocationEnabled: true } : {}),
        },
        orderBy: agentSkillOrderBy,
        select: agentSkillCommandSelect,
    });

    return skills.map((skill) => toAskCommandDefinition(
        skill,
        ASK_COMMAND_SOURCE_ORG_SKILL,
        ORG_SKILL_SOURCE_LABEL,
    ));
};
