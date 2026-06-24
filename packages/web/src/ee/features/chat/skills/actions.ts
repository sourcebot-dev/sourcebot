'use server';

import { checkAskEntitlement } from "@/features/chat/utils.server";
import { type AskCommandDefinition } from "@/features/chat/commands/types";
import { ErrorCode } from "@/lib/errorCodes";
import { isUniqueConstraintError } from "@/lib/prismaErrors";
import { requestBodySchemaValidationError, ServiceError } from "@/lib/serviceError";
import { sew } from "@/middleware/sew";
import { withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { OrgRole, Prisma, orgAgentSkillAuthScope, orgAgentSkillScope, orgAgentSkillVisibleToUserWhere, personalAgentSkillAuthScope, personalAgentSkillScope, type Org, type PrismaClient } from "@sourcebot/db";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import {
    agentSkillInputSchema,
    agentSkillOrderBy,
    toOrgAgentSkillCatalogItem,
    toOrgAgentSkillManagementItem,
    toAgentSkillListItem,
    updateAgentSkillInputSchema,
    type AgentSkillInput,
    type AgentSkillListItem,
    type OrgAgentSkillCatalogItem,
    type OrgAgentSkillManagementItem,
    type UpdateAgentSkillInput,
} from "./types";
import {
    listOrgAgentSkillCommandsForContext,
    listPersonalAgentSkillCommandsForContext,
} from "./commandCatalog";

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

const orgCatalogSkillSelect = (userId: string, orgId: number) => ({
    id: true,
    visibility: true,
    slug: true,
    name: true,
    description: true,
    argumentNames: true,
    enabled: true,
    autoInvocationEnabled: true,
    featured: true,
    autoEnrolled: true,
    createdById: true,
    createdAt: true,
    updatedAt: true,
    adoptions: {
        where: {
            userId,
            orgId,
        },
        select: {
            id: true,
            removedAt: true,
        },
    },
});

const orgManagementSkillSelect = {
    id: true,
    visibility: true,
    slug: true,
    name: true,
    description: true,
    argumentNames: true,
    enabled: true,
    autoInvocationEnabled: true,
    featured: true,
    autoEnrolled: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.AgentSkillSelect;

type AgentSkillWriteClient = Pick<PrismaClient, "agentSkill" | "agentSkillAdoption">;
type ManageableOrgSkill = {
    id: string;
    createdById: string;
};

const canManageOrgSkill = (
    skill: { createdById: string },
    userId: string,
    role: OrgRole,
) => skill.createdById === userId || role === OrgRole.OWNER;

const requireManageableOrgSkill = async ({
    prisma,
    orgId,
    userId,
    role,
    skillId,
    requireEnabled = true,
}: {
    prisma: PrismaClient;
    orgId: number;
    userId: string;
    role: OrgRole;
    skillId: string;
    requireEnabled?: boolean;
}): Promise<ManageableOrgSkill | ServiceError> => {
    const skill = await prisma.agentSkill.findFirst({
        where: {
            id: skillId,
            ...orgAgentSkillAuthScope(orgId),
            ...(requireEnabled ? { enabled: true } : {}),
        },
        select: {
            id: true,
            createdById: true,
        },
    });

    if (!skill) {
        return skillNotFound();
    }

    if (!canManageOrgSkill(skill, userId, role)) {
        return insufficientSkillPermissions();
    }

    return skill;
};

const orgSkillCreateDataForUser = ({
    orgId,
    userId,
    skill,
}: {
    orgId: number;
    userId: string;
    // Accepts either a full skill input (direct org creation) or a partial copy
    // (publishing a personal skill). Auto-invocation defaults off when not
    // explicitly provided, so publishing never opts a skill in implicitly.
    skill: Pick<AgentSkillInput, "slug" | "name" | "description" | "instructions" | "argumentNames"> & {
        autoInvocationEnabled?: boolean;
    };
}) => ({
    ...orgAgentSkillScope(orgId),
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    instructions: skill.instructions,
    argumentNames: skill.argumentNames,
    autoInvocationEnabled: skill.autoInvocationEnabled ?? false,
    createdById: userId,
    updatedById: userId,
    orgId,
    adoptions: {
        create: {
            orgId,
            userId,
            removedAt: null,
        },
    },
});

const createOrgSkillForUser = async ({
    prisma,
    orgId,
    userId,
    skill,
}: {
    prisma: AgentSkillWriteClient;
    orgId: number;
    userId: string;
    skill: AgentSkillInput;
}) => {
    const createdSkill = await prisma.agentSkill.create({
        data: orgSkillCreateDataForUser({ orgId, userId, skill }),
    });

    return createdSkill;
};

const removeOrgSkillForUser = async ({
    prisma,
    orgId,
    userId,
    skill,
}: {
    prisma: AgentSkillWriteClient;
    orgId: number;
    userId: string;
    skill: { id: string; autoEnrolled: boolean };
}) => {
    if (skill.autoEnrolled) {
        const removedAt = new Date();
        await prisma.agentSkillAdoption.upsert({
            where: {
                orgId_userId_agentSkillId: {
                    orgId,
                    userId,
                    agentSkillId: skill.id,
                },
            },
            create: {
                orgId,
                userId,
                agentSkillId: skill.id,
                removedAt,
            },
            update: {
                removedAt,
            },
        });
        return;
    }

    await prisma.agentSkillAdoption.deleteMany({
        where: {
            orgId,
            userId,
            agentSkillId: skill.id,
        },
    });
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

        return listPersonalAgentSkillCommandsForContext({ prisma, userId: user.id });
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

export const getOrgAgentSkill = async (
    skillId: string,
): Promise<AgentSkillListItem | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const manageableSkill = await requireManageableOrgSkill({
            prisma,
            orgId: org.id,
            userId: user.id,
            role,
            skillId,
            requireEnabled: true,
        });

        if ("errorCode" in manageableSkill) {
            return manageableSkill;
        }

        const skill = await prisma.agentSkill.findFirst({
            where: {
                id: manageableSkill.id,
                ...orgAgentSkillAuthScope(org.id),
                enabled: true,
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
                        autoInvocationEnabled: parsed.data.autoInvocationEnabled,
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
                        autoInvocationEnabled: parsed.data.autoInvocationEnabled,
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
                    data: orgSkillCreateDataForUser({
                        orgId: org.id,
                        userId: user.id,
                        skill: personalSkill,
                    }),
                    select: {
                        id: true,
                    },
                });

                await tx.agentSkill.delete({
                    where: {
                        id: skillId,
                    },
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

            return toOrgAgentSkillCatalogItem(orgSkill, user.id);
        } catch (error) {
            if (isUniqueConstraintError(error)) {
                return skillAlreadyExists(personalSkill.slug);
            }

            throw error;
        }
    }));

export const makeOrgAgentSkillPersonal = async (
    skillId: string,
): Promise<AgentSkillListItem | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const orgSkill = await prisma.agentSkill.findFirst({
            where: {
                id: skillId,
                ...orgAgentSkillAuthScope(org.id),
                enabled: true,
            },
            select: {
                id: true,
                slug: true,
                name: true,
                description: true,
                instructions: true,
                argumentNames: true,
                createdById: true,
                autoEnrolled: true,
            },
        });

        if (!orgSkill) {
            return skillNotFound();
        }

        if (!canManageOrgSkill(orgSkill, user.id, role)) {
            const visibleSkill = await prisma.agentSkill.findFirst({
                where: {
                    id: skillId,
                    ...orgAgentSkillVisibleToUserWhere(user.id, org.id),
                },
                select: {
                    id: true,
                },
            });

            if (!visibleSkill) {
                return insufficientSkillPermissions();
            }
        }

        try {
            const personalSkill = await prisma.$transaction(async (tx) => {
                const createdSkill = await tx.agentSkill.create({
                    data: {
                        ...personalAgentSkillScope(user.id),
                        slug: orgSkill.slug,
                        name: orgSkill.name,
                        description: orgSkill.description,
                        instructions: orgSkill.instructions,
                        argumentNames: orgSkill.argumentNames,
                        createdById: user.id,
                        updatedById: user.id,
                        orgId: null,
                    },
                });

                if (orgSkill.createdById === user.id) {
                    await tx.agentSkill.delete({
                        where: {
                            id: orgSkill.id,
                        },
                    });
                } else {
                    await removeOrgSkillForUser({
                        prisma: tx,
                        orgId: org.id,
                        userId: user.id,
                        skill: orgSkill,
                    });
                }

                return createdSkill;
            });

            return toAgentSkillListItem(personalSkill);
        } catch (error) {
            if (isUniqueConstraintError(error)) {
                return skillAlreadyExists(orgSkill.slug);
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

        return skills.map((skill) => toOrgAgentSkillCatalogItem(skill, user.id));
    }));

export const listOrgAgentSkillManagement = async (): Promise<OrgAgentSkillManagementItem[] | ServiceError> => sew(() =>
    withAuth(async ({ org, role, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        return withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const skills = await prisma.agentSkill.findMany({
                where: {
                    ...orgAgentSkillAuthScope(org.id),
                    enabled: true,
                },
                orderBy: [
                    { featured: "desc" as const },
                    ...agentSkillOrderBy,
                ],
                select: orgManagementSkillSelect,
            });

            return skills.map(toOrgAgentSkillManagementItem);
        });
    }));

export const listOrgAgentSkillCommands = async (): Promise<AskCommandDefinition[] | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        return listOrgAgentSkillCommandsForContext({ prisma, userId: user.id, orgId: org.id });
    }));

export const listAgentSkillCommands = async (): Promise<AskCommandDefinition[] | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const [personalCommands, orgCommands] = await Promise.all([
            listPersonalAgentSkillCommandsForContext({ prisma, userId: user.id }),
            listOrgAgentSkillCommandsForContext({ prisma, userId: user.id, orgId: org.id }),
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

            try {
                const skill = await prisma.$transaction(async (tx) => {
                    return createOrgSkillForUser({
                        prisma: tx,
                        orgId: org.id,
                        userId: user.id,
                        skill: parsed.data,
                    });
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

            const existingSkill = await requireManageableOrgSkill({
                prisma,
                orgId: org.id,
                userId: user.id,
                role,
                skillId: parsed.data.id,
                requireEnabled: true,
            });

            if ("errorCode" in existingSkill) {
                return existingSkill;
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
                        autoInvocationEnabled: parsed.data.autoInvocationEnabled,
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

        const existingSkill = await requireManageableOrgSkill({
            prisma,
            orgId: org.id,
            userId: user.id,
            role,
            skillId,
            requireEnabled: true,
        });

        if ("errorCode" in existingSkill) {
            return existingSkill;
        }

        await prisma.agentSkill.delete({
            where: { id: existingSkill.id },
        });

        return { success: true };
    }));

export const setOrgSkillFlag = async (
    input: OrgSkillFlagInput,
): Promise<OrgAgentSkillManagementItem | ServiceError> => {
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
                    select: orgManagementSkillSelect,
                });

                return toOrgAgentSkillManagementItem(skill);
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
                removedAt: null,
            },
            update: {
                removedAt: null,
            },
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
                autoEnrolled: true,
            },
        });

        if (!skill) {
            return skillNotFound();
        }

        await removeOrgSkillForUser({
            prisma,
            orgId: org.id,
            userId: user.id,
            skill,
        });

        return { success: true };
    }));
