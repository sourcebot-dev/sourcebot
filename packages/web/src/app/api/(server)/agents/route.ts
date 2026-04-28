'use server';

import { apiHandler } from "@/lib/apiHandler";
import { requestBodySchemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { OrgRole } from "@sourcebot/db";
import { NextRequest } from "next/server";
import { z } from "zod";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "@/lib/errorCodes";
import { AgentScope, AgentType, PromptMode } from "@sourcebot/db";
import { createLogger } from "@sourcebot/shared";
import { agentConfigSettingsSchema } from "@/features/agents/review-agent/app";

const logger = createLogger('agents-api');

const createAgentConfigBodySchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    type: z.nativeEnum(AgentType),
    enabled: z.boolean().default(true),
    prompt: z.string().optional(),
    promptMode: z.nativeEnum(PromptMode).default(PromptMode.APPEND),
    scope: z.nativeEnum(AgentScope),
    repoIds: z.array(z.number().int().positive()).optional(),
    connectionIds: z.array(z.number().int().positive()).optional(),
    settings: agentConfigSettingsSchema.optional().default({}),
});

export const GET = apiHandler(async (_request: NextRequest) => {
    const result = await withAuth(async ({ org, prisma }) => {
        const configs = await prisma.agentConfig.findMany({
            where: { orgId: org.id },
            include: {
                repos: {
                    include: {
                        repo: {
                            select: { id: true, displayName: true, external_id: true, external_codeHostType: true },
                        },
                    },
                },
                connections: {
                    include: {
                        connection: {
                            select: { id: true, name: true, connectionType: true },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return configs.map(config => ({
            ...config,
            repos: config.repos.map(r => ({
                ...r,
                repo: {
                    id: r.repo.id,
                    displayName: r.repo.displayName,
                    externalId: r.repo.external_id,
                    externalCodeHostType: r.repo.external_codeHostType,
                },
            })),
        }));
    });

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result, { status: StatusCodes.OK });
});

export const POST = apiHandler(async (request: NextRequest) => {
    const body = await request.json();
    const parsed = createAgentConfigBodySchema.safeParse(body);

    if (!parsed.success) {
        return serviceErrorResponse(requestBodySchemaValidationError(parsed.error));
    }

    const { name, description, type, enabled, prompt, promptMode, scope, repoIds, connectionIds, settings } = parsed.data;

    const result = await withAuth(async ({ org, role, prisma }) => {
        return withMinimumOrgRole(role, OrgRole.OWNER, async () => {
        // Check for name collision within org
        const existing = await prisma.agentConfig.findUnique({
            where: { orgId_name: { orgId: org.id, name } },
        });

        if (existing) {
            return {
                statusCode: StatusCodes.CONFLICT,
                errorCode: ErrorCode.AGENT_CONFIG_ALREADY_EXISTS,
                message: `An agent config named '${name}' already exists`,
            };
        }

        // Validate scope-specific IDs
        if (scope === AgentScope.REPO && (!repoIds || repoIds.length === 0)) {
            return {
                statusCode: StatusCodes.BAD_REQUEST,
                errorCode: ErrorCode.INVALID_REQUEST_BODY,
                message: "repoIds is required when scope is REPO",
            };
        }

        if (scope === AgentScope.CONNECTION && (!connectionIds || connectionIds.length === 0)) {
            return {
                statusCode: StatusCodes.BAD_REQUEST,
                errorCode: ErrorCode.INVALID_REQUEST_BODY,
                message: "connectionIds is required when scope is CONNECTION",
            };
        }

        // Verify all provided IDs belong to this org
        if (scope === AgentScope.REPO && repoIds && repoIds.length > 0) {
            const count = await prisma.repo.count({
                where: { id: { in: repoIds }, orgId: org.id },
            });
            if (count !== repoIds.length) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVALID_REQUEST_BODY,
                    message: "One or more repoIds are invalid or do not belong to this org",
                };
            }
        }

        if (scope === AgentScope.CONNECTION && connectionIds && connectionIds.length > 0) {
            const count = await prisma.connection.count({
                where: { id: { in: connectionIds }, orgId: org.id },
            });
            if (count !== connectionIds.length) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVALID_REQUEST_BODY,
                    message: "One or more connectionIds are invalid or do not belong to this org",
                };
            }
        }

        // Enforce scope-level uniqueness
        if (enabled !== false) {
            if (scope === AgentScope.ORG) {
                const conflict = await prisma.agentConfig.findFirst({
                    where: { orgId: org.id, type, scope: AgentScope.ORG, enabled: true },
                });
                if (conflict) {
                    return {
                        statusCode: StatusCodes.CONFLICT,
                        errorCode: ErrorCode.AGENT_CONFIG_SCOPE_CONFLICT,
                        message: `An org-wide config of this type already exists: '${conflict.name}'`,
                    };
                }
            }

            if (scope === AgentScope.REPO && repoIds && repoIds.length > 0) {
                const conflict = await prisma.agentConfig.findFirst({
                    where: {
                        orgId: org.id, type, scope: AgentScope.REPO, enabled: true,
                        repos: { some: { repoId: { in: repoIds } } },
                    },
                });
                if (conflict) {
                    return {
                        statusCode: StatusCodes.CONFLICT,
                        errorCode: ErrorCode.AGENT_CONFIG_SCOPE_CONFLICT,
                        message: `One or more of the selected repos is already covered by config '${conflict.name}'`,
                    };
                }
            }

            if (scope === AgentScope.CONNECTION && connectionIds && connectionIds.length > 0) {
                const conflict = await prisma.agentConfig.findFirst({
                    where: {
                        orgId: org.id, type, scope: AgentScope.CONNECTION, enabled: true,
                        connections: { some: { connectionId: { in: connectionIds } } },
                    },
                });
                if (conflict) {
                    return {
                        statusCode: StatusCodes.CONFLICT,
                        errorCode: ErrorCode.AGENT_CONFIG_SCOPE_CONFLICT,
                        message: `One or more of the selected connections is already covered by config '${conflict.name}'`,
                    };
                }
            }
        }

        try {
            const config = await prisma.agentConfig.create({
                data: {
                    orgId: org.id,
                    name,
                    description,
                    type,
                    enabled,
                    prompt,
                    promptMode,
                    scope,
                    settings,
                    repos: scope === AgentScope.REPO && repoIds
                        ? { create: repoIds.map((repoId) => ({ repoId })) }
                        : undefined,
                    connections: scope === AgentScope.CONNECTION && connectionIds
                        ? { create: connectionIds.map((connectionId) => ({ connectionId })) }
                        : undefined,
                },
                include: {
                    repos: {
                        include: {
                            repo: {
                                select: { id: true, displayName: true, external_id: true, external_codeHostType: true },
                            },
                        },
                    },
                    connections: {
                        include: {
                            connection: {
                                select: { id: true, name: true, connectionType: true },
                            },
                        },
                    },
                },
            });

            return {
                ...config,
                repos: config.repos.map(r => ({
                    ...r,
                    repo: {
                        id: r.repo.id,
                        displayName: r.repo.displayName,
                        externalId: r.repo.external_id,
                        externalCodeHostType: r.repo.external_codeHostType,
                    },
                })),
            };
        } catch (error) {
            logger.error('Error creating agent config', { error, name, orgId: org.id });
            throw error;
        }
        });
    });

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result, { status: StatusCodes.CREATED });
});
