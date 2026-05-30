import { auth as mcpAuth } from '@ai-sdk/mcp';
import { apiHandler } from '@/lib/apiHandler';
import { withAuth } from '@/middleware/withAuth';
import { sew } from '@/middleware/sew';
import { isServiceError } from '@/lib/utils';
import { serviceErrorResponse, notFound, requestBodySchemaValidationError, ServiceErrorException } from '@/lib/serviceError';
import { PrismaOAuthClientProvider } from '@/ee/features/chat/mcp/prismaOAuthClientProvider';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { hasEntitlement } from '@/lib/entitlements';
import { OAUTH_NOT_SUPPORTED_ERROR_MESSAGE } from '@/ee/features/oauth/constants';
import { ConnectMcpResponse } from "@/app/api/(server)/ee/askmcp/connect/types";
import { createLogger, env } from "@sourcebot/shared";
import { __unsafePrisma } from '@/prisma';
import { getExternalMcpErrorLogFields } from '@/ee/features/chat/mcp/externalMcpError';
import { getMcpOAuthCallbackUrl } from '@/ee/features/chat/mcp/utils.server';
import { ErrorCode } from '@/lib/errorCodes';
import { StatusCodes } from 'http-status-codes';
import { normalizeMcpOAuthReturnTo } from '@/ee/features/chat/mcp/mcpOAuthReturnTo';
import { captureEvent } from '@/lib/posthog';
import { getMcpAuthMode, getMcpConnectorEntryPoint, getMcpConnectorFailureReason } from '@/ee/features/chat/mcp/analytics';

const bodySchema = z.object({
    serverId: z.string(),
    returnTo: z.string().optional(),
});
const logger = createLogger('mcp-connect');
const MCP_AUTH_FETCH_TIMEOUT_MS = Math.min(env.SOURCEBOT_MCP_TOOL_CALL_TIMEOUT_MS, 30000);
const MCP_AUTH_TRANSACTION_MAX_WAIT_MS = 10000;
const MCP_AUTH_TRANSACTION_TIMEOUT_MS = MCP_AUTH_FETCH_TIMEOUT_MS + 5000;

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

export const POST = apiHandler(async (request: NextRequest) => {
    if (!(await hasEntitlement('ask'))) {
        return Response.json(
            { error: 'access_denied', error_description: OAUTH_NOT_SUPPORTED_ERROR_MESSAGE },
            { status: 403 }
        );
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return serviceErrorResponse({
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.INVALID_REQUEST_BODY,
            message: 'Invalid JSON request body.',
        });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
        return serviceErrorResponse(requestBodySchemaValidationError(parsed.error));
    }

    const result = await sew(() =>
    withAuth(async ({ user, org, prisma }) => {
        const callbackReturnTo = normalizeMcpOAuthReturnTo(parsed.data.returnTo);
        const entryPoint = getMcpConnectorEntryPoint(parsed.data.returnTo);
        const mcpServer = await prisma.mcpServer.findFirst({
            where: { id: parsed.data.serverId, orgId: org.id },
            select: {
                id: true,
                serverUrl: true,
                clientInfoSource: true,
            },
        });
        if (!mcpServer) {
            void captureEvent('ask_mcp_connector_connection_failed', {
                source: 'sourcebot-web-client',
                entryPoint,
                serverId: parsed.data.serverId,
                failureReason: 'connector_not_found',
            });
            return notFound('Connector not found');
        }

        const eventProperties = {
            source: 'sourcebot-web-client' as const,
            entryPoint,
            serverId: mcpServer.id,
            serverUrl: mcpServer.serverUrl,
            authMode: getMcpAuthMode(mcpServer.clientInfoSource),
        };

        void captureEvent('ask_mcp_connector_connection_started', eventProperties);

        await prisma.userMcpServer.upsert({
            where: {
                userId_serverId: {
                    userId: user.id,
                    serverId: mcpServer.id,
                },
            },
            create: {
                userId: user.id,
                serverId: mcpServer.id,
            },
            update: {},
        });

        const connectResult = await __unsafePrisma.$transaction(async (tx) => {
            const lockedRows = await tx.$queryRaw<{ id: string }[]>`
                SELECT id
                FROM "McpServer"
                WHERE id = ${mcpServer.id} AND "orgId" = ${org.id}
                FOR UPDATE
            `;

            if (lockedRows.length === 0) {
                throw new ServiceErrorException(notFound('Connector not found'));
            }

            const provider = new PrismaOAuthClientProvider({
                prisma: tx,
                clientInvalidationPrisma: tx,
                serverId: mcpServer.id,
                orgId: org.id,
                userId: user.id,
                callbackUrl: getMcpOAuthCallbackUrl(),
                callbackReturnTo,
                allowClientRegistration: true,
            });

            let authResult: Awaited<ReturnType<typeof mcpAuth>>;
            try {
                authResult = await mcpAuth(provider, {
                    serverUrl: new URL(mcpServer.serverUrl),
                    fetchFn: createTimeoutFetch(MCP_AUTH_FETCH_TIMEOUT_MS),
                });
            } catch (error) {
                logger.warn('Failed to start connector authorization.', {
                    serverId: mcpServer.id,
                    orgId: org.id,
                    error: getExternalMcpErrorLogFields(error),
                });
                void captureEvent('ask_mcp_connector_connection_failed', {
                    ...eventProperties,
                    failureReason: getMcpConnectorFailureReason(error),
                });
                throw new ServiceErrorException({
                    statusCode: StatusCodes.BAD_GATEWAY,
                    errorCode: ErrorCode.UNEXPECTED_ERROR,
                    message: 'Could not start connector authorization.',
                });
            }

            return {
                authResult,
                authorizationUrl: provider.authorizationUrl ?? null,
            };
        }, {
            maxWait: MCP_AUTH_TRANSACTION_MAX_WAIT_MS,
            timeout: MCP_AUTH_TRANSACTION_TIMEOUT_MS,
        });

        if (connectResult.authResult === 'AUTHORIZED') {
            // Already has valid tokens (e.g., refreshed)
            void captureEvent('ask_mcp_connector_connection_completed', {
                ...eventProperties,
                alreadyAuthorized: true,
            });
            return { authorizationUrl: null } satisfies ConnectMcpResponse;
        }

        if (!connectResult.authorizationUrl) {
            void captureEvent('ask_mcp_connector_connection_failed', {
                ...eventProperties,
                failureReason: 'missing_authorization_url',
            });
            throw new Error('MCP auth returned REDIRECT without an authorization URL');
        }

        return { authorizationUrl: connectResult.authorizationUrl } satisfies ConnectMcpResponse;
    })
    );

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result);
});
