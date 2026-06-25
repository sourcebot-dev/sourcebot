'use server';

import { checkAskEntitlement } from "@/features/chat/utils.server";
import { type AskCommandDefinition } from "@/features/chat/commands/types";
import { ErrorCode } from "@/lib/errorCodes";
import { isUniqueConstraintError } from "@/lib/prismaErrors";
import { requestBodySchemaValidationError, ServiceError } from "@/lib/serviceError";
import { sew } from "@/middleware/sew";
import { withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { OrgRole, Prisma, sharedAgentSkillAuthScope, sharedAgentSkillScope, sharedAgentSkillVisibleToUserWhere, personalAgentSkillAuthScope, personalAgentSkillScope, type PrismaClient } from "@sourcebot/db";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import {
    agentSkillInputSchema,
    agentSkillOrderBy,
    toSharedAgentSkillCatalogItem,
    toSharedAgentSkillManagementItem,
    toAgentSkillListItem,
    updateAgentSkillInputSchema,
    type AgentSkillInput,
    type AgentSkillListItem,
    type SharedAgentSkillCatalogItem,
    type SharedAgentSkillManagementItem,
    type UpdateAgentSkillInput,
} from "./types";
import {
    listSharedAgentSkillCommandsForContext,
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

const sharedCatalogSkillSelect = (userId: string, orgId: number) => ({
    id: true,
    visibility: true,
    slug: true,
    name: true,
    description: true,
    enabled: true,
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

const sharedManagementSkillSelect = {
    id: true,
    visibility: true,
    slug: true,
    name: true,
    description: true,
    enabled: true,
    featured: true,
    autoEnrolled: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.AgentSkillSelect;

type AgentSkillWriteClient = Pick<PrismaClient, "agentSkill" | "agentSkillAdoption">;
type ManageableSharedSkill = {
    id: string;
    createdById: string;
};

const canManageSharedSkill = (
    skill: { createdById: string },
    userId: string,
    role: OrgRole,
) => skill.createdById === userId || role === OrgRole.OWNER;

const requireManageableSharedSkill = async ({
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
}): Promise<ManageableSharedSkill | ServiceError> => {
    const skill = await prisma.agentSkill.findFirst({
        where: {
            id: skillId,
            ...sharedAgentSkillAuthScope(orgId),
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

    if (!canManageSharedSkill(skill, userId, role)) {
        return insufficientSkillPermissions();
    }

    return skill;
};

const sharedSkillCreateDataForUser = ({
    orgId,
    userId,
    skill,
}: {
    orgId: number;
    userId: string;
    // Accepts either a full skill input (direct shared creation) or a partial
    // copy (publishing a personal skill).
    skill: Pick<AgentSkillInput, "slug" | "name" | "description" | "instructions">;
}) => ({
    ...sharedAgentSkillScope(orgId),
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    instructions: skill.instructions,
    createdById: userId,
    updatedById: userId,
    adoptions: {
        create: {
            orgId,
            userId,
            removedAt: null,
        },
    },
});

const createSharedSkillForUser = async ({
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
        data: sharedSkillCreateDataForUser({ orgId, userId, skill }),
    });

    return createdSkill;
};

const removeSharedSkillForUser = async ({
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

const sharedSkillFlagInputSchema = z.object({
    skillId: z.string().trim().min(1),
    data: z.object({
        featured: z.boolean().optional(),
        autoEnrolled: z.boolean().optional(),
    }).strict().refine(
        (data) => Object.keys(data).length === 1,
        "Exactly one shared skill flag must be provided.",
    ),
});

type SharedSkillFlagInput = z.infer<typeof sharedSkillFlagInputSchema>;

export const listPersonalAgentSkills = async (): Promise<AgentSkillListItem[] | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const skills = await prisma.agentSkill.findMany({
            where: {
                ...personalAgentSkillAuthScope(user.id, org.id),
            },
            orderBy: agentSkillOrderBy,
        });

        return skills.map(toAgentSkillListItem);
    }));

export const listPersonalAgentSkillCommands = async (): Promise<AskCommandDefinition[] | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        return listPersonalAgentSkillCommandsForContext({ prisma, userId: user.id, orgId: org.id });
    }));

export const getPersonalAgentSkill = async (
    skillId: string,
): Promise<AgentSkillListItem | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const skill = await prisma.agentSkill.findFirst({
            where: {
                id: skillId,
                ...personalAgentSkillAuthScope(user.id, org.id),
            },
        });

        if (!skill) {
            return skillNotFound();
        }

        return toAgentSkillListItem(skill);
    }));

export const getSharedAgentSkill = async (
    skillId: string,
): Promise<AgentSkillListItem | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const manageableSkill = await requireManageableSharedSkill({
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
                ...sharedAgentSkillAuthScope(org.id),
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
        withAuth(async ({ org, user, prisma }) => {
            const askError = await checkAskEntitlement();
            if (askError) {
                return askError;
            }

            const scope = personalAgentSkillScope(user.id, org.id);

            try {
                const skill = await prisma.agentSkill.create({
                    data: {
                        ...scope,
                        slug: parsed.data.slug,
                        name: parsed.data.name,
                        description: parsed.data.description,
                        instructions: parsed.data.instructions,
                        createdById: user.id,
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

export const updatePersonalAgentSkill = async (
    input: UpdateAgentSkillInput,
): Promise<AgentSkillListItem | ServiceError> => {
    const parsed = updateAgentSkillInputSchema.safeParse(input);
    if (!parsed.success) {
        return requestBodySchemaValidationError(parsed.error);
    }

    return sew(() =>
        withAuth(async ({ org, user, prisma }) => {
            const askError = await checkAskEntitlement();
            if (askError) {
                return askError;
            }

            const scope = personalAgentSkillAuthScope(user.id, org.id);
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
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const result = await prisma.agentSkill.deleteMany({
            where: {
                id: skillId,
                ...personalAgentSkillAuthScope(user.id, org.id),
            },
        });

        if (result.count === 0) {
            return skillNotFound();
        }

        return { success: true };
    }));

export const publishPersonalAgentSkillToShared = async (
    skillId: string,
): Promise<SharedAgentSkillCatalogItem | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const personalSkill = await prisma.agentSkill.findFirst({
            where: {
                id: skillId,
                ...personalAgentSkillAuthScope(user.id, org.id),
            },
            select: {
                slug: true,
                name: true,
                description: true,
                instructions: true,
            },
        });

        if (!personalSkill) {
            return skillNotFound();
        }

        try {
            const sharedSkill = await prisma.$transaction(async (tx) => {
                const createdSkill = await tx.agentSkill.create({
                    data: sharedSkillCreateDataForUser({
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
                        ...sharedAgentSkillAuthScope(org.id),
                    },
                    select: sharedCatalogSkillSelect(user.id, org.id),
                });

                if (!selectedSkill) {
                    throw new Error("Created shared skill was not found.");
                }

                return selectedSkill;
            });

            return toSharedAgentSkillCatalogItem(sharedSkill, user.id);
        } catch (error) {
            if (isUniqueConstraintError(error)) {
                return skillAlreadyExists(personalSkill.slug);
            }

            throw error;
        }
    }));

export const makeSharedAgentSkillPersonal = async (
    skillId: string,
): Promise<AgentSkillListItem | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const sharedSkill = await prisma.agentSkill.findFirst({
            where: {
                id: skillId,
                ...sharedAgentSkillAuthScope(org.id),
                enabled: true,
            },
            select: {
                id: true,
                slug: true,
                name: true,
                description: true,
                instructions: true,
                createdById: true,
                autoEnrolled: true,
            },
        });

        if (!sharedSkill) {
            return skillNotFound();
        }

        if (!canManageSharedSkill(sharedSkill, user.id, role)) {
            const visibleSkill = await prisma.agentSkill.findFirst({
                where: {
                    id: skillId,
                    ...sharedAgentSkillVisibleToUserWhere(user.id, org.id),
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
                        ...personalAgentSkillScope(user.id, org.id),
                        slug: sharedSkill.slug,
                        name: sharedSkill.name,
                        description: sharedSkill.description,
                        instructions: sharedSkill.instructions,
                        createdById: user.id,
                        updatedById: user.id,
                    },
                });

                if (sharedSkill.createdById === user.id) {
                    await tx.agentSkill.delete({
                        where: {
                            id: sharedSkill.id,
                        },
                    });
                } else {
                    await removeSharedSkillForUser({
                        prisma: tx,
                        orgId: org.id,
                        userId: user.id,
                        skill: sharedSkill,
                    });
                }

                return createdSkill;
            });

            return toAgentSkillListItem(personalSkill);
        } catch (error) {
            if (isUniqueConstraintError(error)) {
                return skillAlreadyExists(sharedSkill.slug);
            }

            throw error;
        }
    }));

export const listSharedAgentSkillCatalog = async (): Promise<SharedAgentSkillCatalogItem[] | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const skills = await prisma.agentSkill.findMany({
            where: {
                ...sharedAgentSkillAuthScope(org.id),
                enabled: true,
            },
            orderBy: [
                { featured: "desc" as const },
                ...agentSkillOrderBy,
            ],
            select: sharedCatalogSkillSelect(user.id, org.id),
        });

        return skills.map((skill) => toSharedAgentSkillCatalogItem(skill, user.id));
    }));

export const listSharedAgentSkillManagement = async (): Promise<SharedAgentSkillManagementItem[] | ServiceError> => sew(() =>
    withAuth(async ({ org, role, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        return withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const skills = await prisma.agentSkill.findMany({
                where: {
                    ...sharedAgentSkillAuthScope(org.id),
                    enabled: true,
                },
                orderBy: [
                    { featured: "desc" as const },
                    ...agentSkillOrderBy,
                ],
                select: sharedManagementSkillSelect,
            });

            return skills.map(toSharedAgentSkillManagementItem);
        });
    }));

export const listSharedAgentSkillCommands = async (): Promise<AskCommandDefinition[] | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        return listSharedAgentSkillCommandsForContext({ prisma, userId: user.id, orgId: org.id });
    }));

export const listAgentSkillCommands = async (): Promise<AskCommandDefinition[] | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const [personalCommands, sharedCommands] = await Promise.all([
            listPersonalAgentSkillCommandsForContext({ prisma, userId: user.id, orgId: org.id }),
            listSharedAgentSkillCommandsForContext({ prisma, userId: user.id, orgId: org.id }),
        ]);

        return [
            ...personalCommands,
            ...sharedCommands,
        ];
    }));

export const createSharedAgentSkill = async (
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
                    return createSharedSkillForUser({
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

export const updateSharedAgentSkill = async (
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

            const existingSkill = await requireManageableSharedSkill({
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

export const deleteSharedAgentSkill = async (
    skillId: string,
): Promise<{ success: true } | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const existingSkill = await requireManageableSharedSkill({
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

export const setSharedSkillFlag = async (
    input: SharedSkillFlagInput,
): Promise<SharedAgentSkillManagementItem | ServiceError> => {
    const parsed = sharedSkillFlagInputSchema.safeParse(input);
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
                        ...sharedAgentSkillAuthScope(org.id),
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
                    select: sharedManagementSkillSelect,
                });

                return toSharedAgentSkillManagementItem(skill);
            });
        }));
};

export const adoptSharedSkill = async (
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
                ...sharedAgentSkillAuthScope(org.id),
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

export const unadoptSharedSkill = async (
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
                ...sharedAgentSkillAuthScope(org.id),
            },
            select: {
                id: true,
                autoEnrolled: true,
            },
        });

        if (!skill) {
            return skillNotFound();
        }

        await removeSharedSkillForUser({
            prisma,
            orgId: org.id,
            userId: user.id,
            skill,
        });

        return { success: true };
    }));
