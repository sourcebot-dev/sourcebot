'use server';

import { checkAskEntitlement } from "@/features/chat/utils.server";
import { getArgumentHint } from "@/features/chat/commands/argumentSubstitution";
import { ASK_COMMAND_SOURCE_ORG_SKILL, ASK_COMMAND_SOURCE_PERSONAL_SKILL, type AskCommandDefinition } from "@/features/chat/commands/types";
import { ErrorCode } from "@/lib/errorCodes";
import { isUniqueConstraintError } from "@/lib/prismaErrors";
import { requestBodySchemaValidationError, ServiceError } from "@/lib/serviceError";
import { sew } from "@/middleware/sew";
import { withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { OrgRole, orgAgentSkillAuthScope, orgAgentSkillScope, orgAgentSkillVisibleToUserWhere, personalAgentSkillAuthScope, personalAgentSkillScope, type Org, type PrismaClient, type UserWithAccounts } from "@sourcebot/db";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import {
    agentSkillInputSchema,
    agentSkillOrderBy,
    toOrgAgentSkillCatalogItem,
    toAgentSkillListItem,
    updateAgentSkillInputSchema,
    type AgentSkillInput,
    type AgentSkillListItem,
    type OrgAgentSkillCatalogItem,
    type UpdateAgentSkillInput,
} from "./types";

const PERSONAL_SKILL_SOURCE_LABEL = "Personal";
const ORG_SKILL_SOURCE_LABEL = "Workspace";

const skillAlreadyExists = (slug: string): ServiceError => ({
    statusCode: StatusCodes.CONFLICT,
    errorCode: ErrorCode.AGENT_SKILL_ALREADY_EXISTS,
    message: `A skill with command /${slug} already exists.`,
});

const skillNotFound = (): ServiceError => ({
    statusCode: StatusCodes.NOT_FOUND,
    errorCode: ErrorCode.AGENT_SKILL_NOT_FOUND,
    message: "Skill not found.",
});

const insufficientSkillPermissions = (): ServiceError => ({
    statusCode: StatusCodes.FORBIDDEN,
    errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
    message: "You do not have sufficient permissions to manage this skill.",
});

const toAskCommandDefinition = (
    skill: {
        id: string;
        slug: string;
        name: string;
        description: string;
        instructions: string;
        argumentNames: string[];
    },
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

const orgCatalogSkillSelect = (userId: string, orgId: number) => ({
    id: true,
    visibility: true,
    slug: true,
    name: true,
    description: true,
    argumentNames: true,
    enabled: true,
    featured: true,
    autoEnrolled: true,
    createdAt: true,
    updatedAt: true,
    adoptions: {
        where: {
            userId,
            orgId,
        },
        select: {
            id: true,
        },
    },
});

type AgentSkillCommandContext = {
    org: Org;
    user: UserWithAccounts;
    prisma: PrismaClient;
};

const orgSkillFlagInputSchema = z.object({
    skillId: z.string().trim().min(1),
    data: z.object({
        featured: z.boolean().optional(),
        autoEnrolled: z.boolean().optional(),
    }).strict().refine(
        (data) => Object.keys(data).length === 1,
        "Exactly one org skill flag must be provided.",
    ),
});

type OrgSkillFlagInput = z.infer<typeof orgSkillFlagInputSchema>;

const listPersonalAgentSkillCommandsForContext = async ({
    prisma,
    user,
}: Pick<AgentSkillCommandContext, "prisma" | "user">): Promise<AskCommandDefinition[]> => {
    const skills = await prisma.agentSkill.findMany({
        where: {
            ...personalAgentSkillAuthScope(user.id),
            enabled: true,
        },
        orderBy: agentSkillOrderBy,
        select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            instructions: true,
            argumentNames: true,
        },
    });

    return skills.map((skill) => toAskCommandDefinition(
        skill,
        ASK_COMMAND_SOURCE_PERSONAL_SKILL,
        PERSONAL_SKILL_SOURCE_LABEL,
    ));
};

const listOrgAgentSkillCommandsForContext = async ({
    org,
    prisma,
    user,
}: AgentSkillCommandContext): Promise<AskCommandDefinition[]> => {
    const skills = await prisma.agentSkill.findMany({
        where: orgAgentSkillVisibleToUserWhere(user.id, org.id),
        orderBy: agentSkillOrderBy,
        select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            instructions: true,
            argumentNames: true,
        },
    });

    return skills.map((skill) => toAskCommandDefinition(
        skill,
        ASK_COMMAND_SOURCE_ORG_SKILL,
        ORG_SKILL_SOURCE_LABEL,
    ));
};

export const listPersonalAgentSkills = async (): Promise<AgentSkillListItem[] | ServiceError> => sew(() =>
    withAuth(async ({ user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const skills = await prisma.agentSkill.findMany({
            where: {
                ...personalAgentSkillAuthScope(user.id),
            },
            orderBy: agentSkillOrderBy,
        });

        return skills.map(toAgentSkillListItem);
    }));

export const listPersonalAgentSkillCommands = async (): Promise<AskCommandDefinition[] | ServiceError> => sew(() =>
    withAuth(async ({ user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        return listPersonalAgentSkillCommandsForContext({ user, prisma });
    }));

export const getPersonalAgentSkill = async (
    skillId: string,
): Promise<AgentSkillListItem | ServiceError> => sew(() =>
    withAuth(async ({ user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const skill = await prisma.agentSkill.findFirst({
            where: {
                id: skillId,
                ...personalAgentSkillAuthScope(user.id),
            },
        });

        if (!skill) {
            return skillNotFound();
        }

        return toAgentSkillListItem(skill);
    }));

export const createPersonalAgentSkill = async (
    input: AgentSkillInput,
): Promise<AgentSkillListItem | ServiceError> => {
    const parsed = agentSkillInputSchema.safeParse(input);
    if (!parsed.success) {
        return requestBodySchemaValidationError(parsed.error);
    }

    return sew(() =>
        withAuth(async ({ user, prisma }) => {
            const askError = await checkAskEntitlement();
            if (askError) {
                return askError;
            }

            const scope = personalAgentSkillScope(user.id);

            try {
                const skill = await prisma.agentSkill.create({
                    data: {
                        ...scope,
                        slug: parsed.data.slug,
                        name: parsed.data.name,
                        description: parsed.data.description,
                        instructions: parsed.data.instructions,
                        argumentNames: parsed.data.argumentNames,
                        createdById: user.id,
                        updatedById: user.id,
                        orgId: null,
                    },
                });

                return toAgentSkillListItem(skill);
            } catch (error) {
                if (isUniqueConstraintError(error)) {
                    return skillAlreadyExists(parsed.data.slug);
                }

                throw error;
            }
        }));
};

export const updatePersonalAgentSkill = async (
    input: UpdateAgentSkillInput,
): Promise<AgentSkillListItem | ServiceError> => {
    const parsed = updateAgentSkillInputSchema.safeParse(input);
    if (!parsed.success) {
        return requestBodySchemaValidationError(parsed.error);
    }

    return sew(() =>
        withAuth(async ({ user, prisma }) => {
            const askError = await checkAskEntitlement();
            if (askError) {
                return askError;
            }

            const scope = personalAgentSkillAuthScope(user.id);
            const existingSkill = await prisma.agentSkill.findFirst({
                where: {
                    id: parsed.data.id,
                    ...scope,
                },
                select: { id: true },
            });

            if (!existingSkill) {
                return skillNotFound();
            }

            try {
                const skill = await prisma.agentSkill.update({
                    where: { id: existingSkill.id },
                    data: {
                        slug: parsed.data.slug,
                        name: parsed.data.name,
                        description: parsed.data.description,
                        instructions: parsed.data.instructions,
                        argumentNames: parsed.data.argumentNames,
                        updatedById: user.id,
                    },
                });

                return toAgentSkillListItem(skill);
            } catch (error) {
                if (isUniqueConstraintError(error)) {
                    return skillAlreadyExists(parsed.data.slug);
                }

                throw error;
            }
        }));
};

export const deletePersonalAgentSkill = async (
    skillId: string,
): Promise<{ success: true } | ServiceError> => sew(() =>
    withAuth(async ({ user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const result = await prisma.agentSkill.deleteMany({
            where: {
                id: skillId,
                ...personalAgentSkillAuthScope(user.id),
            },
        });

        if (result.count === 0) {
            return skillNotFound();
        }

        return { success: true };
    }));

export const publishPersonalAgentSkillToOrg = async (
    skillId: string,
): Promise<OrgAgentSkillCatalogItem | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const personalSkill = await prisma.agentSkill.findFirst({
            where: {
                id: skillId,
                ...personalAgentSkillAuthScope(user.id),
            },
            select: {
                slug: true,
                name: true,
                description: true,
                instructions: true,
                argumentNames: true,
            },
        });

        if (!personalSkill) {
            return skillNotFound();
        }

        try {
            const orgSkill = await prisma.$transaction(async (tx) => {
                const createdSkill = await tx.agentSkill.create({
                    data: {
                        ...orgAgentSkillScope(org.id),
                        slug: personalSkill.slug,
                        name: personalSkill.name,
                        description: personalSkill.description,
                        instructions: personalSkill.instructions,
                        argumentNames: personalSkill.argumentNames,
                        createdById: user.id,
                        updatedById: user.id,
                        orgId: org.id,
                    },
                    select: {
                        id: true,
                    },
                });

                await tx.agentSkillAdoption.upsert({
                    where: {
                        orgId_userId_agentSkillId: {
                            orgId: org.id,
                            userId: user.id,
                            agentSkillId: createdSkill.id,
                        },
                    },
                    create: {
                        orgId: org.id,
                        userId: user.id,
                        agentSkillId: createdSkill.id,
                    },
                    update: {},
                });

                const selectedSkill = await tx.agentSkill.findFirst({
                    where: {
                        id: createdSkill.id,
                        ...orgAgentSkillAuthScope(org.id),
                    },
                    select: orgCatalogSkillSelect(user.id, org.id),
                });

                if (!selectedSkill) {
                    throw new Error("Created org skill was not found.");
                }

                return selectedSkill;
            });

            return toOrgAgentSkillCatalogItem(orgSkill);
        } catch (error) {
            if (isUniqueConstraintError(error)) {
                return skillAlreadyExists(personalSkill.slug);
            }

            throw error;
        }
    }));

export const listOrgAgentSkillCatalog = async (): Promise<OrgAgentSkillCatalogItem[] | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const skills = await prisma.agentSkill.findMany({
            where: {
                ...orgAgentSkillAuthScope(org.id),
                enabled: true,
            },
            orderBy: [
                { featured: "desc" as const },
                ...agentSkillOrderBy,
            ],
            select: orgCatalogSkillSelect(user.id, org.id),
        });

        return skills.map(toOrgAgentSkillCatalogItem);
    }));

export const listOrgAgentSkillCommands = async (): Promise<AskCommandDefinition[] | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        return listOrgAgentSkillCommandsForContext({ org, user, prisma });
    }));

export const listAgentSkillCommands = async (): Promise<AskCommandDefinition[] | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const [personalCommands, orgCommands] = await Promise.all([
            listPersonalAgentSkillCommandsForContext({ user, prisma }),
            listOrgAgentSkillCommandsForContext({ org, user, prisma }),
        ]);

        return [
            ...personalCommands,
            ...orgCommands,
        ];
    }));

export const createOrgAgentSkill = async (
    input: AgentSkillInput,
): Promise<AgentSkillListItem | ServiceError> => {
    const parsed = agentSkillInputSchema.safeParse(input);
    if (!parsed.success) {
        return requestBodySchemaValidationError(parsed.error);
    }

    return sew(() =>
        withAuth(async ({ org, user, prisma }) => {
            const askError = await checkAskEntitlement();
            if (askError) {
                return askError;
            }

            const scope = orgAgentSkillScope(org.id);

            try {
                const skill = await prisma.agentSkill.create({
                    data: {
                        ...scope,
                        slug: parsed.data.slug,
                        name: parsed.data.name,
                        description: parsed.data.description,
                        instructions: parsed.data.instructions,
                        argumentNames: parsed.data.argumentNames,
                        createdById: user.id,
                        updatedById: user.id,
                        orgId: org.id,
                    },
                });

                return toAgentSkillListItem(skill);
            } catch (error) {
                if (isUniqueConstraintError(error)) {
                    return skillAlreadyExists(parsed.data.slug);
                }

                throw error;
            }
        }));
};

export const updateOrgAgentSkill = async (
    input: UpdateAgentSkillInput,
): Promise<AgentSkillListItem | ServiceError> => {
    const parsed = updateAgentSkillInputSchema.safeParse(input);
    if (!parsed.success) {
        return requestBodySchemaValidationError(parsed.error);
    }

    return sew(() =>
        withAuth(async ({ org, user, role, prisma }) => {
            const askError = await checkAskEntitlement();
            if (askError) {
                return askError;
            }

            const existingSkill = await prisma.agentSkill.findFirst({
                where: {
                    id: parsed.data.id,
                    ...orgAgentSkillAuthScope(org.id),
                },
                select: {
                    id: true,
                    createdById: true,
                },
            });

            if (!existingSkill) {
                return skillNotFound();
            }

            if (existingSkill.createdById !== user.id && role !== OrgRole.OWNER) {
                return insufficientSkillPermissions();
            }

            try {
                const skill = await prisma.agentSkill.update({
                    where: { id: existingSkill.id },
                    data: {
                        slug: parsed.data.slug,
                        name: parsed.data.name,
                        description: parsed.data.description,
                        instructions: parsed.data.instructions,
                        argumentNames: parsed.data.argumentNames,
                        updatedById: user.id,
                    },
                });

                return toAgentSkillListItem(skill);
            } catch (error) {
                if (isUniqueConstraintError(error)) {
                    return skillAlreadyExists(parsed.data.slug);
                }

                throw error;
            }
        }));
};

export const deleteOrgAgentSkill = async (
    skillId: string,
): Promise<{ success: true } | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const existingSkill = await prisma.agentSkill.findFirst({
            where: {
                id: skillId,
                ...orgAgentSkillAuthScope(org.id),
            },
            select: {
                id: true,
                createdById: true,
            },
        });

        if (!existingSkill) {
            return skillNotFound();
        }

        if (existingSkill.createdById !== user.id && role !== OrgRole.OWNER) {
            return insufficientSkillPermissions();
        }

        await prisma.agentSkill.delete({
            where: { id: existingSkill.id },
        });

        return { success: true };
    }));

export const setOrgSkillFlag = async (
    input: OrgSkillFlagInput,
): Promise<OrgAgentSkillCatalogItem | ServiceError> => {
    const parsed = orgSkillFlagInputSchema.safeParse(input);
    if (!parsed.success) {
        return requestBodySchemaValidationError(parsed.error);
    }

    const { skillId, data } = parsed.data;

    return sew(() =>
        withAuth(async ({ org, user, role, prisma }) => {
            const askError = await checkAskEntitlement();
            if (askError) {
                return askError;
            }

            return withMinimumOrgRole(role, OrgRole.OWNER, async () => {
                const existingSkill = await prisma.agentSkill.findFirst({
                    where: {
                        id: skillId,
                        ...orgAgentSkillAuthScope(org.id),
                    },
                    select: {
                        id: true,
                    },
                });

                if (!existingSkill) {
                    return skillNotFound();
                }

                const skill = await prisma.agentSkill.update({
                    where: { id: existingSkill.id },
                    data: {
                        ...data,
                        updatedById: user.id,
                    },
                    select: orgCatalogSkillSelect(user.id, org.id),
                });

                return toOrgAgentSkillCatalogItem(skill);
            });
        }));
};

export const adoptOrgSkill = async (
    skillId: string,
): Promise<{ success: true } | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const skill = await prisma.agentSkill.findFirst({
            where: {
                id: skillId,
                ...orgAgentSkillAuthScope(org.id),
                enabled: true,
            },
            select: {
                id: true,
            },
        });

        if (!skill) {
            return skillNotFound();
        }

        await prisma.agentSkillAdoption.upsert({
            where: {
                orgId_userId_agentSkillId: {
                    orgId: org.id,
                    userId: user.id,
                    agentSkillId: skill.id,
                },
            },
            create: {
                orgId: org.id,
                userId: user.id,
                agentSkillId: skill.id,
            },
            update: {},
        });

        return { success: true };
    }));

export const unadoptOrgSkill = async (
    skillId: string,
): Promise<{ success: true } | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const skill = await prisma.agentSkill.findFirst({
            where: {
                id: skillId,
                ...orgAgentSkillAuthScope(org.id),
            },
            select: {
                id: true,
            },
        });

        if (!skill) {
            return skillNotFound();
        }

        await prisma.agentSkillAdoption.deleteMany({
            where: {
                orgId: org.id,
                userId: user.id,
                agentSkillId: skill.id,
            },
        });

        return { success: true };
    }));
