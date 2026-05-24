import { auth as mcpAuth } from '@ai-sdk/mcp';
import { apiHandler } from '@/lib/apiHandler';
import { withAuth } from '@/middleware/withAuth';
import { sew } from '@/middleware/sew';
import { isServiceError } from '@/lib/utils';
import { serviceErrorResponse, notFound, requestBodySchemaValidationError, ServiceErrorException } from '@/lib/serviceError';
import { PrismaOAuthClientProvider } from '@/features/mcp/prismaOAuthClientProvider';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { hasEntitlement } from '@/lib/entitlements';
import { OAUTH_NOT_SUPPORTED_ERROR_MESSAGE } from '@/ee/features/oauth/constants';
import { ConnectMcpResponse } from "@/app/api/(server)/ee/askmcp/connect/types";
import { env } from "@sourcebot/shared";
import { __unsafePrisma } from '@/prisma';

const bodySchema = z.object({ serverId: z.string() });
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
    if (!(await hasEntitlement('oauth'))) {
        return Response.json(
            { error: 'access_denied', error_description: OAUTH_NOT_SUPPORTED_ERROR_MESSAGE },
            { status: 403 }
        );
    }

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
        return serviceErrorResponse(requestBodySchemaValidationError(parsed.error));
    }

    const result = await sew(() =>
    withAuth(async ({ user, org, prisma }) => {
        const mcpServer = await prisma.mcpServer.findFirst({
            where: { id: parsed.data.serverId, orgId: org.id },
            select: {
                id: true,
                serverUrl: true,
            },
        });
        if (!mcpServer) {
            return notFound('MCP server not found');
        }

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
                throw new ServiceErrorException(notFound('MCP server not found'));
            }

            const provider = new PrismaOAuthClientProvider({
                prisma: tx,
                clientInvalidationPrisma: tx,
                serverId: mcpServer.id,
                orgId: org.id,
                userId: user.id,
                callbackUrl: `${env.AUTH_URL}/api/ee/askmcp/callback`,
                allowClientRegistration: true,
            });

            const authResult = await mcpAuth(provider, {
                serverUrl: new URL(mcpServer.serverUrl),
                fetchFn: createTimeoutFetch(MCP_AUTH_FETCH_TIMEOUT_MS),
            });

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
            return { authorizationUrl: null } satisfies ConnectMcpResponse;
        }

        if (!connectResult.authorizationUrl) {
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
