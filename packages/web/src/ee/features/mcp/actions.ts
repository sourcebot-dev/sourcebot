'use server';

import { sew } from '@/middleware/sew';
import { ErrorCode } from '@/lib/errorCodes';
import { ServiceError } from '@/lib/serviceError';
import { withAuth } from '@/middleware/withAuth';
import { withMinimumOrgRole } from '@/middleware/withMinimumOrgRole';
import { __unsafePrisma } from '@/prisma';
import { OrgRole } from '@sourcebot/db';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { sanitizeMcpServerName } from './utils';
import { hasEntitlement } from '@/lib/entitlements';
import { oauthNotSupported } from './errors';

export const createMcpServer = async (name: string, serverUrl: string) => sew(() =>
    withAuth(async ({ org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            if (!(await hasEntitlement('oauth'))) {
                return oauthNotSupported();
            }

            const displayName = name.trim();
            const normalizedServerUrl = serverUrl.trim();
            const urlResult = z.string().url().safeParse(normalizedServerUrl);
            const protocol = urlResult.success ? new URL(normalizedServerUrl).protocol : undefined;
            if (!urlResult.success || protocol !== 'https:') {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVALID_REQUEST_BODY,
                    message: 'Invalid server URL. Must be a valid HTTPS URL.',
                } satisfies ServiceError;
            }

            const sanitizedName = sanitizeMcpServerName(displayName);
            const alphanumericCount = (sanitizedName.match(/[a-z0-9]/g) ?? []).length;
            if (alphanumericCount < 3) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVALID_REQUEST_BODY,
                    message: 'Server name must contain at least 3 alphanumeric characters.',
                } satisfies ServiceError;
            }

            const existingServer = await prisma.mcpServer.findUnique({
                where: {
                    serverUrl_orgId: {
                        serverUrl: normalizedServerUrl,
                        orgId: org.id,
                    },
                },
                select: { id: true },
            });
            if (existingServer) {
                return {
                    statusCode: StatusCodes.CONFLICT,
                    errorCode: ErrorCode.MCP_SERVER_ALREADY_EXISTS,
                    message: `An MCP server with URL "${normalizedServerUrl}" already exists.`,
                } satisfies ServiceError;
            }

            const existingName = await prisma.mcpServer.findFirst({
                where: {
                    orgId: org.id,
                    sanitizedName,
                },
                select: { id: true },
            });
            if (existingName) {
                return {
                    statusCode: StatusCodes.CONFLICT,
                    errorCode: ErrorCode.MCP_SERVER_ALREADY_EXISTS,
                    message: `An MCP server with a similar name already exists. Please choose a more distinct name.`,
                } satisfies ServiceError;
            }

            const mcpServer = await prisma.mcpServer.create({
                data: {
                    name: displayName,
                    sanitizedName,
                    serverUrl: normalizedServerUrl,
                    clientInfo: null,
                    orgId: org.id,
                },
            });

            return {
                id: mcpServer.id,
                name: displayName,
                sanitizedName,
                serverUrl: mcpServer.serverUrl,
            };
        })));

export const deleteMcpServer = async (serverId: string) => sew(() =>
    withAuth(async ({ org, role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const result = await __unsafePrisma.mcpServer.deleteMany({
                where: {
                    id: serverId,
                    orgId: org.id,
                },
            });

            if (result.count === 0) {
                return {
                    statusCode: StatusCodes.NOT_FOUND,
                    errorCode: ErrorCode.MCP_SERVER_NOT_FOUND,
                    message: 'MCP server not found',
                } satisfies ServiceError;
            }

            return { success: true };
        })));
