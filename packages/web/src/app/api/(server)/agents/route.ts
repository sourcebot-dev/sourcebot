'use server';

import { apiHandler } from "@/lib/apiHandler";
import { requestBodySchemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { withAuth } from "@/middleware/withAuth";
import { NextRequest } from "next/server";
import { z } from "zod";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "@/lib/errorCodes";
import { AgentScope, AgentType, PromptMode } from "@sourcebot/db";
import { createLogger } from "@sourcebot/shared";

const logger = createLogger('agents-api');

const agentConfigSettingsSchema = z.object({
    autoReviewEnabled: z.boolean().optional(),
    reviewCommand: z.string().optional(),
    model: z.string().optional(),
});

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

        return configs;
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

    const result = await withAuth(async ({ org, prisma }) => {
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

            return config;
        } catch (error) {
            logger.error('Error creating agent config', { error, name, orgId: org.id });
            throw error;
        }
    });

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result, { status: StatusCodes.CREATED });
});
