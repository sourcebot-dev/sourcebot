'use server';

import { apiHandler } from "@/lib/apiHandler";
import { requestBodySchemaValidationError, serviceErrorResponse, notFound } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { withAuth } from "@/middleware/withAuth";
import { NextRequest } from "next/server";
import { z } from "zod";
import { StatusCodes } from "http-status-codes";
import { AgentScope, AgentType, PromptMode } from "@sourcebot/db";
import { createLogger } from "@sourcebot/shared";

const logger = createLogger('agents-api');

const agentConfigSettingsSchema = z.object({
    autoReviewEnabled: z.boolean().optional(),
    reviewCommand: z.string().optional(),
    model: z.string().optional(),
});

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

    const result = await withAuth(async ({ org, prisma }) => {
        const existing = await prisma.agentConfig.findFirst({
            where: { id: agentId, orgId: org.id },
        });

        if (!existing) {
            return notFound(`Agent config '${agentId}' not found`);
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

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result, { status: StatusCodes.OK });
});

export const DELETE = apiHandler(async (_request: NextRequest, { params }: RouteParams) => {
    const { agentId } = await params;

    const result = await withAuth(async ({ org, prisma }) => {
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

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result, { status: StatusCodes.OK });
});
