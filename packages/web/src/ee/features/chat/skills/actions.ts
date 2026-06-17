'use server';

import { checkAskEntitlement } from "@/features/chat/utils.server";
import { getArgumentHint } from "@/features/chat/commands/argumentSubstitution";
import { ASK_COMMAND_SOURCE_PERSONAL_SKILL, type AskCommandDefinition } from "@/features/chat/commands/types";
import { ErrorCode } from "@/lib/errorCodes";
import { isUniqueConstraintError } from "@/lib/prismaErrors";
import { requestBodySchemaValidationError, ServiceError } from "@/lib/serviceError";
import { sew } from "@/middleware/sew";
import { withAuth } from "@/middleware/withAuth";
import { personalAgentSkillScope } from "@sourcebot/db";
import { StatusCodes } from "http-status-codes";
import {
    agentSkillInputSchema,
    agentSkillOrderBy,
    toAgentSkillListItem,
    updateAgentSkillInputSchema,
    type AgentSkillInput,
    type AgentSkillListItem,
    type UpdateAgentSkillInput,
} from "./types";

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

export const listPersonalAgentSkills = async (): Promise<AgentSkillListItem[] | ServiceError> => sew(() =>
    withAuth(async ({ user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const skills = await prisma.agentSkill.findMany({
            where: {
                ...personalAgentSkillScope(user.id),
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

        const skills = await prisma.agentSkill.findMany({
            where: {
                ...personalAgentSkillScope(user.id),
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

        return skills.map((skill) => ({
            id: skill.id,
            sourceId: ASK_COMMAND_SOURCE_PERSONAL_SKILL,
            slug: skill.slug,
            name: skill.name,
            description: skill.description,
            argumentHint: getArgumentHint(skill.instructions, skill.argumentNames),
        }));
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
                ...personalAgentSkillScope(user.id),
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

            const scope = personalAgentSkillScope(user.id);
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
                ...personalAgentSkillScope(user.id),
            },
        });

        if (result.count === 0) {
            return skillNotFound();
        }

        return { success: true };
    }));
