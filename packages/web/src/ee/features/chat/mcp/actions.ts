'use server';

import { sew } from '@/middleware/sew';
import { ErrorCode } from '@/lib/errorCodes';
import { requestBodySchemaValidationError, ServiceError } from '@/lib/serviceError';
import { withAuth } from '@/middleware/withAuth';
import { withMinimumOrgRole } from '@/middleware/withMinimumOrgRole';
import { __unsafePrisma } from '@/prisma';
import { isServiceError } from '@/lib/utils';
import { McpServerClientInfoSource, OrgRole, type PrismaClient } from '@sourcebot/db';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { sanitizeMcpServerName } from '@/features/chat/mcp/utils';
import { hasEntitlement } from '@/lib/entitlements';
import { oauthNotSupported } from './errors';
import { checkMcpServerDcrSupport } from './dcrDiscovery';
import { encryptOAuthToken, env } from '@sourcebot/shared';
import { captureEvent } from '@/lib/posthog';
import { getMcpAuthMode } from './analytics';
import type { McpConnectorEntryPoint } from '@/lib/posthogEvents';

const MCP_DCR_DISCOVERY_TIMEOUT_MS = Math.min(env.SOURCEBOT_MCP_TOOL_CALL_TIMEOUT_MS, 10000);
const createStaticOAuthMcpServerSchema = z.object({
    name: z.string().trim().min(1),
    serverUrl: z.string().trim().url(),
    clientId: z.string().trim().min(1),
    clientSecret: z.string().trim().min(1),
});

export type CreateStaticOAuthMcpServerRequest = z.infer<typeof createStaticOAuthMcpServerSchema>;

export interface CreateStaticOAuthMcpServerResponse {
    id: string;
    name: string;
    sanitizedName: string;
    serverUrl: string;
}

type McpServerPrismaClient = Pick<PrismaClient, 'mcpServer'>;

interface PreparedMcpServerCreate {
    displayName: string;
    normalizedServerUrl: string;
    sanitizedName: string;
}

function createTimeoutFetch(timeoutMs: number): typeof fetch {
    return async (input, init) => {
        const timeoutSignal = AbortSignal.timeout(timeoutMs);
        const signal = init?.signal
            ? AbortSignal.any([init.signal, timeoutSignal])
            : timeoutSignal;

        return fetch(input, {
            ...init,
            signal,
        });
    };
}

function invalidRequest(message: string): ServiceError {
    return {
        statusCode: StatusCodes.BAD_REQUEST,
        errorCode: ErrorCode.INVALID_REQUEST_BODY,
        message,
    };
}

function assertHttpsAuthUrlInProduction(): ServiceError | undefined {
    if (env.NODE_ENV !== 'production') {
        return undefined;
    }

    if (new URL(env.AUTH_URL).protocol === 'https:') {
        return undefined;
    }

    return invalidRequest('Static OAuth client credentials require HTTPS in production.');
}

async function prepareMcpServerCreate({
    prisma,
    orgId,
    name,
    serverUrl,
}: {
    prisma: McpServerPrismaClient;
    orgId: number;
    name: string;
    serverUrl: string;
}): Promise<PreparedMcpServerCreate | ServiceError> {
    const displayName = name.trim();
    const normalizedServerUrl = serverUrl.trim();
    const urlResult = z.string().url().safeParse(normalizedServerUrl);
    const protocol = urlResult.success ? new URL(normalizedServerUrl).protocol : undefined;
    if (!urlResult.success || protocol !== 'https:') {
        return invalidRequest('Invalid connector URL. Must be a valid HTTPS URL.');
    }

    const sanitizedName = sanitizeMcpServerName(displayName);
    const alphanumericCount = (sanitizedName.match(/[a-z0-9]/g) ?? []).length;
    if (alphanumericCount < 3) {
        return invalidRequest('Connector name must contain at least 3 alphanumeric characters.');
    }

    const existingServer = await prisma.mcpServer.findUnique({
        where: {
            serverUrl_orgId: {
                serverUrl: normalizedServerUrl,
                orgId,
            },
        },
        select: { id: true },
    });
    if (existingServer) {
        return {
            statusCode: StatusCodes.CONFLICT,
            errorCode: ErrorCode.MCP_SERVER_ALREADY_EXISTS,
            message: `A connector with URL "${normalizedServerUrl}" already exists.`,
        } satisfies ServiceError;
    }

    const existingName = await prisma.mcpServer.findFirst({
        where: {
            orgId,
            sanitizedName,
        },
        select: { id: true },
    });
    if (existingName) {
        return {
            statusCode: StatusCodes.CONFLICT,
            errorCode: ErrorCode.MCP_SERVER_ALREADY_EXISTS,
            message: 'A connector with a similar name already exists. Please choose a more distinct name.',
        } satisfies ServiceError;
    }

    return {
        displayName,
        normalizedServerUrl,
        sanitizedName,
    };
}

export const checkMcpServerDynamicClientRegistration = async (serverUrl: string) => sew(() =>
    withAuth(async ({ role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            if (!(await hasEntitlement('ask'))) {
                return oauthNotSupported();
            }

            const normalizedServerUrl = serverUrl.trim();
            const urlResult = z.string().url().safeParse(normalizedServerUrl);
            const protocol = urlResult.success ? new URL(normalizedServerUrl).protocol : undefined;
            if (!urlResult.success || protocol !== 'https:') {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVALID_REQUEST_BODY,
                    message: 'Invalid connector URL. Must be a valid HTTPS URL.',
                } satisfies ServiceError;
            }

            try {
                return await checkMcpServerDcrSupport(
                    normalizedServerUrl,
                    createTimeoutFetch(MCP_DCR_DISCOVERY_TIMEOUT_MS),
                );
            } catch {
                return {
                    statusCode: StatusCodes.BAD_GATEWAY,
                    errorCode: ErrorCode.UNEXPECTED_ERROR,
                    message: 'Could not check whether this connector supports dynamic client registration.',
                } satisfies ServiceError;
            }
        })));

export const createStaticOAuthMcpServer = async (
    body: CreateStaticOAuthMcpServerRequest,
) => {
    const parsed = createStaticOAuthMcpServerSchema.safeParse(body);
    if (!parsed.success) {
        return requestBodySchemaValidationError(parsed.error);
    }

    return sew(() =>
        withAuth(async ({ org, role, prisma }) =>
            withMinimumOrgRole(role, OrgRole.OWNER, async (): Promise<CreateStaticOAuthMcpServerResponse | ServiceError> => {
                if (!(await hasEntitlement('ask'))) {
                    return oauthNotSupported();
                }

                const httpsError = assertHttpsAuthUrlInProduction();
                if (httpsError) {
                    return httpsError;
                }

                const preparedServer = await prepareMcpServerCreate({
                    prisma,
                    orgId: org.id,
                    name: parsed.data.name,
                    serverUrl: parsed.data.serverUrl,
                });
                if (isServiceError(preparedServer)) {
                    return preparedServer;
                }

                const clientInfo = encryptOAuthToken(JSON.stringify({
                    client_id: parsed.data.clientId,
                    client_secret: parsed.data.clientSecret,
                }));
                if (!clientInfo) {
                    return {
                        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                        errorCode: ErrorCode.UNEXPECTED_ERROR,
                        message: 'Failed to store OAuth client credentials.',
                    } satisfies ServiceError;
                }

                const mcpServer = await prisma.mcpServer.create({
                    data: {
                        name: preparedServer.displayName,
                        sanitizedName: preparedServer.sanitizedName,
                        serverUrl: preparedServer.normalizedServerUrl,
                        clientInfo,
                        clientInfoSource: McpServerClientInfoSource.STATIC,
                        orgId: org.id,
                    },
                });

                void captureEvent('ask_mcp_connector_added', {
                    source: 'sourcebot-web-client',
                    entryPoint: 'workspace_settings',
                    serverId: mcpServer.id,
                    serverUrl: mcpServer.serverUrl,
                    authMode: 'static',
                });

                return {
                    id: mcpServer.id,
                    name: preparedServer.displayName,
                    sanitizedName: preparedServer.sanitizedName,
                    serverUrl: mcpServer.serverUrl,
                };
            })));
}

export const createMcpServer = async (name: string, serverUrl: string) => sew(() =>
    withAuth(async ({ org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            if (!(await hasEntitlement('ask'))) {
                return oauthNotSupported();
            }

            const preparedServer = await prepareMcpServerCreate({
                prisma,
                orgId: org.id,
                name,
                serverUrl,
            });
            if (isServiceError(preparedServer)) {
                return preparedServer;
            }

            const mcpServer = await prisma.mcpServer.create({
                data: {
                    name: preparedServer.displayName,
                    sanitizedName: preparedServer.sanitizedName,
                    serverUrl: preparedServer.normalizedServerUrl,
                    clientInfo: null,
                    clientInfoSource: McpServerClientInfoSource.DYNAMIC,
                    orgId: org.id,
                },
            });

            void captureEvent('ask_mcp_connector_added', {
                source: 'sourcebot-web-client',
                entryPoint: 'workspace_settings',
                serverId: mcpServer.id,
                serverUrl: mcpServer.serverUrl,
                authMode: getMcpAuthMode(McpServerClientInfoSource.DYNAMIC),
            });

            return {
                id: mcpServer.id,
                name: preparedServer.displayName,
                sanitizedName: preparedServer.sanitizedName,
                serverUrl: mcpServer.serverUrl,
            };
        })));

export const deleteMcpServer = async (serverId: string) => sew(() =>
    withAuth(async ({ org, role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const server = await __unsafePrisma.mcpServer.findFirst({
                where: {
                    id: serverId,
                    orgId: org.id,
                },
                select: {
                    id: true,
                    serverUrl: true,
                    clientInfoSource: true,
                },
            });

            if (!server) {
                return {
                    statusCode: StatusCodes.NOT_FOUND,
                    errorCode: ErrorCode.MCP_SERVER_NOT_FOUND,
                    message: 'Connector not found',
                } satisfies ServiceError;
            }

            await __unsafePrisma.mcpServer.deleteMany({
                where: {
                    id: serverId,
                    orgId: org.id,
                },
            });

            void captureEvent('ask_mcp_connector_removed', {
                source: 'sourcebot-web-client',
                entryPoint: 'workspace_settings',
                serverId: server.id,
                serverUrl: server.serverUrl,
                authMode: getMcpAuthMode(server.clientInfoSource),
            });

            return { success: true };
        })));

export const disconnectMcpServer = async (serverId: string, entryPoint: McpConnectorEntryPoint) => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const server = await prisma.mcpServer.findFirst({
            where: {
                id: serverId,
                orgId: org.id,
            },
            select: {
                id: true,
                serverUrl: true,
                clientInfoSource: true,
            },
        });

        if (!server) {
            return {
                statusCode: StatusCodes.NOT_FOUND,
                errorCode: ErrorCode.MCP_SERVER_NOT_FOUND,
                message: 'Connector not found',
            } satisfies ServiceError;
        }

        const result = await prisma.userMcpServer.deleteMany({
            where: {
                serverId,
                userId: user.id,
            },
        });

        if (result.count === 0) {
            return {
                statusCode: StatusCodes.NOT_FOUND,
                errorCode: ErrorCode.MCP_SERVER_NOT_FOUND,
                message: 'No connection found for this connector.',
            } satisfies ServiceError;
        }

        void captureEvent('ask_mcp_connector_disconnected', {
            source: 'sourcebot-web-client',
            entryPoint,
            serverId: server.id,
            serverUrl: server.serverUrl,
            authMode: getMcpAuthMode(server.clientInfoSource),
        });

        return { success: true };
    }));
