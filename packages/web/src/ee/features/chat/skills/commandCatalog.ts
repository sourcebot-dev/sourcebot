import {
    sharedAgentSkillVisibleToUserWhere,
    personalAgentSkillAuthScope,
    type Prisma,
    type PrismaClient,
} from "@sourcebot/db";
import {
    ASK_COMMAND_SOURCE_PERSONAL_SKILL,
    ASK_COMMAND_SOURCE_SHARED_SKILL,
    type AskCommandDefinition,
} from "@/features/chat/commands/types";
import { agentSkillOrderBy } from "./types";
import { filterSkillsBySourceRepoAccess } from "./sourceRepoAccess";

// Display labels for where a skill command originates. Shared by the manual
// slash-command catalog (the listAgentSkillCommands actions) and the
// auto-invocation catalog (buildSkillRegistry) so both surface a skill's source
// identically.
export const PERSONAL_SKILL_SOURCE_LABEL = "Personal";
export const SHARED_SKILL_SOURCE_LABEL = "Shared";

export const sourceLabelForSkillSourceId = (sourceId: string): string =>
    sourceId === ASK_COMMAND_SOURCE_SHARED_SKILL ? SHARED_SKILL_SOURCE_LABEL : PERSONAL_SKILL_SOURCE_LABEL;

// The minimal columns needed to build an AskCommandDefinition. Instructions are
// loaded on demand (manual: at materialization; auto: at load_skill), never in
// the catalog the model sees. sourceRepoName is selected only to apply the
// source-repo access gate; it is not surfaced in the command definition.
const agentSkillCommandSelect = {
    id: true,
    slug: true,
    name: true,
    description: true,
    sourceRepoName: true,
} satisfies Prisma.AgentSkillSelect;

type AgentSkillCommandRow = {
    id: string;
    slug: string;
    name: string;
    description: string;
    sourceRepoName: string | null;
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
    isSynced: typeof skill.sourceRepoName === "string",
});

/**
 * Lists the requester's personal skills (scoped to the current org) as
 * slash-command definitions. The manual and auto catalogs share this query,
 * select, ordering, and mapping so they can never drift.
 */
export const listPersonalAgentSkillCommandsForContext = async ({
    prisma,
    userId,
    orgId,
}: {
    prisma: PrismaClient;
    userId: string;
    orgId: number;
}): Promise<AskCommandDefinition[]> => {
    const skills = await prisma.agentSkill.findMany({
        where: {
            ...personalAgentSkillAuthScope(userId, orgId),
            enabled: true,
        },
        orderBy: agentSkillOrderBy,
        select: agentSkillCommandSelect,
    });

    const accessibleSkills = await filterSkillsBySourceRepoAccess(skills, { prisma, orgId });

    return accessibleSkills.map((skill) => toAskCommandDefinition(
        skill,
        ASK_COMMAND_SOURCE_PERSONAL_SKILL,
        PERSONAL_SKILL_SOURCE_LABEL,
    ));
};

/**
 * Lists the shared skills visible to the requester as slash-command definitions,
 * applying the shared-visibility clause (enabled + adopted/auto-enrolled +
 * not-removed). See {@link listPersonalAgentSkillCommandsForContext}.
 */
export const listSharedAgentSkillCommandsForContext = async ({
    prisma,
    userId,
    orgId,
}: {
    prisma: PrismaClient;
    userId: string;
    orgId: number;
}): Promise<AskCommandDefinition[]> => {
    const skills = await prisma.agentSkill.findMany({
        where: {
            ...sharedAgentSkillVisibleToUserWhere(userId, orgId),
        },
        orderBy: agentSkillOrderBy,
        select: agentSkillCommandSelect,
    });

    const accessibleSkills = await filterSkillsBySourceRepoAccess(skills, { prisma, orgId });

    return accessibleSkills.map((skill) => toAskCommandDefinition(
        skill,
        ASK_COMMAND_SOURCE_SHARED_SKILL,
        SHARED_SKILL_SOURCE_LABEL,
    ));
};
