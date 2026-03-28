'use server';

import { sew } from '@/actions';
import { ErrorCode } from '@/lib/errorCodes';
import { ServiceError } from '@/lib/serviceError';
import { withAuthV2 } from '@/withAuthV2';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { sanitizeMcpServerName } from './utils';

export const createMcpServer = async (name: string, serverUrl: string) => sew(() =>
    withAuthV2(async ({ org, user, prisma }) => {
        const urlResult = z.string().url().safeParse(serverUrl);
        if (!urlResult.success || !serverUrl.startsWith('https://')) {
            return {
                statusCode: StatusCodes.BAD_REQUEST,
                errorCode: ErrorCode.INVALID_REQUEST_BODY,
                message: 'Invalid server URL. Must be a valid HTTPS URL.',
            } satisfies ServiceError;
        }

        const sanitizedName = sanitizeMcpServerName(name);
        const alphanumericCount = (sanitizedName.match(/[a-z0-9]/g) ?? []).length;
        if (alphanumericCount < 3) {
            return {
                statusCode: StatusCodes.BAD_REQUEST,
                errorCode: ErrorCode.INVALID_REQUEST_BODY,
                message: 'Server name must contain at least 3 alphanumeric characters.',
            } satisfies ServiceError;
        }

        // Upsert the McpServer record — reuse if the endpoint already exists for this org.
        const mcpServer = await prisma.mcpServer.upsert({
            where: {
                serverUrl_orgId: {
                    serverUrl,
                    orgId: org.id,
                },
            },
            update: {},
            create: {
                serverUrl,
                orgId: org.id,
            },
        });

        // Check if this user already has this server in their list.
        const existingUserServer = await prisma.userMcpServer.findUnique({
            where: {
                userId_serverId: {
                    userId: user.id,
                    serverId: mcpServer.id,
                },
            },
        });

        if (existingUserServer) {
            return {
                statusCode: StatusCodes.CONFLICT,
                errorCode: ErrorCode.MCP_SERVER_ALREADY_EXISTS,
                message: `You have already added an MCP server with URL "${serverUrl}".`,
            } satisfies ServiceError;
        }

        // Ensure the sanitized name is unique within the user's own servers to prevent
        // tool-name collisions (e.g. "My Server" and "My-Server" both become "my_server").
        const userServers = await prisma.userMcpServer.findMany({
            where: { userId: user.id },
            select: { name: true },
        });
        const nameCollision = userServers.some(
            (s) => sanitizeMcpServerName(s.name) === sanitizedName
        );
        if (nameCollision) {
            return {
                statusCode: StatusCodes.CONFLICT,
                errorCode: ErrorCode.MCP_SERVER_ALREADY_EXISTS,
                message: `You already have an MCP server with a similar name. Please choose a more distinct name.`,
            } satisfies ServiceError;
        }

        await prisma.userMcpServer.create({
            data: {
                userId: user.id,
                serverId: mcpServer.id,
                name,
            },
        });

        return {
            id: mcpServer.id,
            name,
            serverUrl: mcpServer.serverUrl,
        };
    }));

export const deleteMcpServer = async (serverId: string) => sew(() =>
    withAuthV2(async ({ user, prisma }) => {
        const userServer = await prisma.userMcpServer.findUnique({
            where: {
                userId_serverId: {
                    userId: user.id,
                    serverId,
                },
            },
        });

        if (!userServer) {
            return {
                statusCode: StatusCodes.NOT_FOUND,
                errorCode: ErrorCode.MCP_SERVER_NOT_FOUND,
                message: 'MCP server not found',
            } satisfies ServiceError;
        }

        // Delete the user's reference and their credentials. The McpServer row stays
        // because other users may reference the same endpoint.
        await prisma.$transaction([
            prisma.mcpServerCredential.deleteMany({
                where: {
                    userId: user.id,
                    serverId,
                },
            }),
            prisma.userMcpServer.delete({
                where: {
                    userId_serverId: {
                        userId: user.id,
                        serverId,
                    },
                },
            }),
        ]);

        return { success: true };
    }));