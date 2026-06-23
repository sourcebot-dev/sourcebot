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
} from "@/features/chat/commands/types";
import { agentSkillOrderBy } from "./types";

// Source labels mirror the manual command catalog (see actions.ts) so analytics
// and any future UI surface auto-invocation consistently with slash commands.
const PERSONAL_SKILL_SOURCE_LABEL = "Personal";
const ORG_SKILL_SOURCE_LABEL = "Workspace";

const sourceLabelForId = (sourceId: string): string =>
    sourceId === ASK_COMMAND_SOURCE_ORG_SKILL ? ORG_SKILL_SOURCE_LABEL : PERSONAL_SKILL_SOURCE_LABEL;

// A single entry in the skill catalog the Ask agent injects into its system
// prompt. Intentionally excludes `instructions` to keep the catalog small —
// instructions are fetched on demand when the model calls `load_skill`.
export interface SkillRegistryEntry {
    // The AgentSkill id. This is the handle the model passes to `load_skill`.
    // We key on id (not slug) because personal and org skills can share a slug
    // (slug is unique only within a namespace).
    id: string;
    sourceId: string;
    sourceLabel: string;
    slug: string;
    name: string;
    description: string;
    argumentHint?: string;
}

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

const catalogSelect = {
    id: true,
    slug: true,
    name: true,
    description: true,
    instructions: true,
    argumentNames: true,
} satisfies Prisma.AgentSkillSelect;

type CatalogSkillRow = {
    id: string;
    slug: string;
    name: string;
    description: string;
    instructions: string;
    argumentNames: string[];
};

const toRegistryEntry = (skill: CatalogSkillRow, sourceId: string): SkillRegistryEntry => ({
    id: skill.id,
    sourceId,
    sourceLabel: sourceLabelForId(sourceId),
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    argumentHint: getArgumentHint(skill.instructions, skill.argumentNames),
});

/**
 * Builds the auto-invocation skill catalog for a given requester, reusing the
 * exact auth-scope clauses the manual slash-command pipeline uses. Only skills
 * that are enabled, visible to the requester, AND opted in to auto-invocation
 * (`autoInvocationEnabled`) are included — so the model can never see or load a
 * skill the requester could not already invoke manually.
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
}): Promise<SkillRegistryEntry[]> => {
    const [personalSkills, orgSkills] = await Promise.all([
        prisma.agentSkill.findMany({
            where: {
                ...personalAgentSkillAuthScope(userId),
                enabled: true,
                autoInvocationEnabled: true,
            },
            orderBy: agentSkillOrderBy,
            select: catalogSelect,
        }),
        orgId !== undefined
            ? prisma.agentSkill.findMany({
                where: {
                    ...orgAgentSkillVisibleToUserWhere(userId, orgId),
                    autoInvocationEnabled: true,
                },
                orderBy: agentSkillOrderBy,
                select: catalogSelect,
            })
            : Promise.resolve([] as CatalogSkillRow[]),
    ]);

    return [
        ...personalSkills.map((skill) => toRegistryEntry(skill, ASK_COMMAND_SOURCE_PERSONAL_SKILL)),
        ...orgSkills.map((skill) => toRegistryEntry(skill, ASK_COMMAND_SOURCE_ORG_SKILL)),
    ];
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
        sourceLabel: sourceLabelForId(sourceId),
        slug: skill.slug,
        name: skill.name,
        instructions: skill.instructions,
        argumentNames: skill.argumentNames,
    };
};
