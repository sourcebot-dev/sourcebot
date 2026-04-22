'use server';

import { apiHandler } from "@/lib/apiHandler";
import { requestBodySchemaValidationError, serviceErrorResponse, notFound } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { ErrorCode } from "@/lib/errorCodes";
import { withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { OrgRole } from "@sourcebot/db";
import { NextRequest } from "next/server";
import { z } from "zod";
import { StatusCodes } from "http-status-codes";
import { AgentScope, AgentType, PromptMode } from "@sourcebot/db";
import { createLogger } from "@sourcebot/shared";
import { agentConfigSettingsSchema } from "@/features/agents/review-agent/app";

const logger = createLogger('agents-api');

const updateAgentConfigBodySchema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().nullable().optional(),
    type: z.nativeEnum(AgentType).optional(),
    enabled: z.boolean().optional(),
    prompt: z.string().nullable().optional(),
    promptMode: z.nativeEnum(PromptMode).optional(),
    scope: z.nativeEnum(AgentScope).optional(),
    repoIds: z.array(z.number().int().positive()).optional(),
    connectionIds: z.array(z.number().int().positive()).optional(),
    settings: agentConfigSettingsSchema.optional(),
});

type RouteParams = { params: Promise<{ agentId: string }> };

const includeRelations = {
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
} as const;

export const GET = apiHandler(async (_request: NextRequest, { params }: RouteParams) => {
    const { agentId } = await params;

    const result = await withAuth(async ({ org, prisma }) => {
        const config = await prisma.agentConfig.findFirst({
            where: { id: agentId, orgId: org.id },
            include: includeRelations,
        });

        if (!config) {
            return notFound(`Agent config '${agentId}' not found`);
        }

        return config;
    });

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result, { status: StatusCodes.OK });
});

export const PATCH = apiHandler(async (request: NextRequest, { params }: RouteParams) => {
    const { agentId } = await params;

    const body = await request.json();
    const parsed = updateAgentConfigBodySchema.safeParse(body);

    if (!parsed.success) {
        return serviceErrorResponse(requestBodySchemaValidationError(parsed.error));
    }

    const { name, description, type, enabled, prompt, promptMode, scope, repoIds, connectionIds, settings } = parsed.data;

    const result = await withAuth(async ({ org, role, prisma }) => {
        return withMinimumOrgRole(role, OrgRole.OWNER, async () => {
        const existing = await prisma.agentConfig.findFirst({
            where: { id: agentId, orgId: org.id },
            include: {
                repos: { select: { repoId: true } },
                connections: { select: { connectionId: true } },
            },
        });

        if (!existing) {
            return notFound(`Agent config '${agentId}' not found`);
        }

        // Check for name collision with a different config in the same org
        if (name !== undefined && name !== existing.name) {
            const collision = await prisma.agentConfig.findUnique({
                where: { orgId_name: { orgId: org.id, name } },
            });

            if (collision) {
                return {
                    statusCode: StatusCodes.CONFLICT,
                    errorCode: ErrorCode.AGENT_CONFIG_ALREADY_EXISTS,
                    message: `An agent config named '${name}' already exists`,
                };
            }
        }

        const effectiveScope = scope ?? existing.scope;

        // When scope changes to REPO/CONNECTION, IDs must be supplied
        if (effectiveScope === 'REPO' && scope === 'REPO' && (!repoIds || repoIds.length === 0)) {
            return {
                statusCode: StatusCodes.BAD_REQUEST,
                errorCode: 'INVALID_REQUEST_BODY',
                message: "repoIds is required when scope is REPO",
            };
        }

        if (effectiveScope === 'CONNECTION' && scope === 'CONNECTION' && (!connectionIds || connectionIds.length === 0)) {
            return {
                statusCode: StatusCodes.BAD_REQUEST,
                errorCode: 'INVALID_REQUEST_BODY',
                message: "connectionIds is required when scope is CONNECTION",
            };
        }

        // Verify all provided IDs belong to this org
        if (repoIds && repoIds.length > 0) {
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

        if (connectionIds && connectionIds.length > 0) {
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

        // Enforce scope-level uniqueness (only when the config is or will be enabled)
        const willBeEnabled = enabled !== undefined ? enabled : existing.enabled;
        if (willBeEnabled) {
            const effectiveType = type ?? existing.type;
            const notSelf = { id: { not: agentId } };

            if (effectiveScope === AgentScope.ORG) {
                const conflict = await prisma.agentConfig.findFirst({
                    where: { orgId: org.id, type: effectiveType, scope: AgentScope.ORG, enabled: true, ...notSelf },
                });
                if (conflict) {
                    return {
                        statusCode: StatusCodes.CONFLICT,
                        errorCode: ErrorCode.AGENT_CONFIG_SCOPE_CONFLICT,
                        message: `An org-wide config of this type already exists: '${conflict.name}'`,
                    };
                }
            }

            const effectiveRepoIds = repoIds ?? (effectiveScope === AgentScope.REPO
                ? existing.repos?.map((r: { repoId: number }) => r.repoId) ?? []
                : []);
            if (effectiveScope === AgentScope.REPO && effectiveRepoIds.length > 0) {
                const conflict = await prisma.agentConfig.findFirst({
                    where: {
                        orgId: org.id, type: effectiveType, scope: AgentScope.REPO, enabled: true, ...notSelf,
                        repos: { some: { repoId: { in: effectiveRepoIds } } },
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

            const effectiveConnectionIds = connectionIds ?? (effectiveScope === AgentScope.CONNECTION
                ? existing.connections?.map((c: { connectionId: number }) => c.connectionId) ?? []
                : []);
            if (effectiveScope === AgentScope.CONNECTION && effectiveConnectionIds.length > 0) {
                const conflict = await prisma.agentConfig.findFirst({
                    where: {
                        orgId: org.id, type: effectiveType, scope: AgentScope.CONNECTION, enabled: true, ...notSelf,
                        connections: { some: { connectionId: { in: effectiveConnectionIds } } },
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
            // Rebuild junction table rows when scope or IDs are updated
            const updated = await prisma.agentConfig.update({
                where: { id: agentId },
                data: {
                    ...(name !== undefined && { name }),
                    ...(description !== undefined && { description }),
                    ...(type !== undefined && { type }),
                    ...(enabled !== undefined && { enabled }),
                    ...(prompt !== undefined && { prompt }),
                    ...(promptMode !== undefined && { promptMode }),
                    ...(scope !== undefined && { scope }),
                    ...(settings !== undefined && { settings }),
                    ...(repoIds !== undefined && {
                        repos: {
                            deleteMany: {},
                            create: repoIds.map((repoId) => ({ repoId })),
                        },
                    }),
                    ...(connectionIds !== undefined && {
                        connections: {
                            deleteMany: {},
                            create: connectionIds.map((connectionId) => ({ connectionId })),
                        },
                    }),
                },
                include: includeRelations,
            });

            return updated;
        } catch (error) {
            logger.error('Error updating agent config', { error, agentId, orgId: org.id });
            throw error;
        }
        });
    });

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result, { status: StatusCodes.OK });
});

export const DELETE = apiHandler(async (_request: NextRequest, { params }: RouteParams) => {
    const { agentId } = await params;

    const result = await withAuth(async ({ org, role, prisma }) => {
        return withMinimumOrgRole(role, OrgRole.OWNER, async () => {
        const existing = await prisma.agentConfig.findFirst({
            where: { id: agentId, orgId: org.id },
        });

        if (!existing) {
            return notFound(`Agent config '${agentId}' not found`);
        }

        try {
            await prisma.agentConfig.delete({ where: { id: agentId } });
            return { success: true };
        } catch (error) {
            logger.error('Error deleting agent config', { error, agentId, orgId: org.id });
            throw error;
        }
        });
    });

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result, { status: StatusCodes.OK });
});
