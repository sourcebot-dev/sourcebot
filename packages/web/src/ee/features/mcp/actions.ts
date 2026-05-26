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
import { sanitizeMcpServerName } from './utils';
import { hasEntitlement } from '@/lib/entitlements';
import { oauthNotSupported } from './errors';
import { checkMcpServerDcrSupport } from './dcrDiscovery';
import { encryptOAuthToken, env } from '@sourcebot/shared';
import { headers } from 'next/headers';

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

function getFirstHeaderValue(value: string | null): string | undefined {
    return value?.split(',')[0]?.trim().toLowerCase();
}

function getHeaderUrlProtocol(value: string | null, host: string | undefined): string | undefined {
    if (!value || !host) {
        return undefined;
    }

    try {
        const url = new URL(value);
        return url.host === host ? url.protocol : undefined;
    } catch {
        return undefined;
    }
}

async function assertHttpsInProduction(): Promise<ServiceError | undefined> {
    if (env.NODE_ENV !== 'production') {
        return undefined;
    }

    const requestHeaders = await headers();
    const publicAuthUrlIsHttps = new URL(env.AUTH_URL).protocol === 'https:';
    const host = getFirstHeaderValue(requestHeaders.get('x-forwarded-host'))
        ?? getFirstHeaderValue(requestHeaders.get('host'));
    const originProtocol = getHeaderUrlProtocol(requestHeaders.get('origin'), host);
    const refererProtocol = getHeaderUrlProtocol(requestHeaders.get('referer'), host);
    const requestIsHttps = getFirstHeaderValue(requestHeaders.get('x-forwarded-proto')) === 'https'
        || getFirstHeaderValue(requestHeaders.get('x-forwarded-ssl')) === 'on'
        || originProtocol === 'https:'
        || refererProtocol === 'https:';

    if (publicAuthUrlIsHttps && requestIsHttps) {
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
        return invalidRequest('Invalid server URL. Must be a valid HTTPS URL.');
    }

    const sanitizedName = sanitizeMcpServerName(displayName);
    const alphanumericCount = (sanitizedName.match(/[a-z0-9]/g) ?? []).length;
    if (alphanumericCount < 3) {
        return invalidRequest('Server name must contain at least 3 alphanumeric characters.');
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
            message: `An MCP server with URL "${normalizedServerUrl}" already exists.`,
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
            message: 'An MCP server with a similar name already exists. Please choose a more distinct name.',
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
            if (!(await hasEntitlement('oauth'))) {
                return oauthNotSupported();
            }

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

            try {
                return await checkMcpServerDcrSupport(
                    normalizedServerUrl,
                    createTimeoutFetch(MCP_DCR_DISCOVERY_TIMEOUT_MS),
                );
            } catch {
                return {
                    statusCode: StatusCodes.BAD_GATEWAY,
                    errorCode: ErrorCode.UNEXPECTED_ERROR,
                    message: 'Could not check whether this MCP server supports dynamic client registration.',
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
                if (!(await hasEntitlement('oauth'))) {
                    return oauthNotSupported();
                }

                const httpsError = await assertHttpsInProduction();
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
            if (!(await hasEntitlement('oauth'))) {
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
