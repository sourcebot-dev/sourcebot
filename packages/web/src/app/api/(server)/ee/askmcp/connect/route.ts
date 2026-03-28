import { auth as mcpAuth } from '@ai-sdk/mcp';
import { apiHandler } from '@/lib/apiHandler';
import { withAuthV2 } from '@/withAuthV2';
import { sew } from '@/actions';
import { isServiceError } from '@/lib/utils';
import { serviceErrorResponse, notFound, requestBodySchemaValidationError } from '@/lib/serviceError';
import { PrismaOAuthClientProvider } from '@/features/mcp/prismaOAuthClientProvider';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { hasEntitlement } from '@sourcebot/shared';
import { OAUTH_NOT_SUPPORTED_ERROR_MESSAGE } from '@/ee/features/oauth/constants';
import { ConnectMcpResponse } from "@/app/api/(server)/ee/askmcp/connect/types";
import { env } from "@sourcebot/shared";

const bodySchema = z.object({ serverId: z.string() });

export const POST = apiHandler(async (request: NextRequest) => {
    if (!hasEntitlement('oauth')) {
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
    withAuthV2(async ({ user, org, prisma }) => {
        const mcpServer = await prisma.mcpServer.findUnique({
            where: { id: parsed.data.serverId, orgId: org.id },
        });
        if (!mcpServer) {
            return notFound('MCP server not found');
        }

        // Verify the user has added this server to their list.
        const userServer = await prisma.userMcpServer.findUnique({
            where: {
                userId_serverId: {
                    userId: user.id,
                    serverId: mcpServer.id,
                },
            },
        });
        if (!userServer) {
            return notFound('MCP server not found');
        }

        const provider = new PrismaOAuthClientProvider(
            mcpServer.id,
            user.id,
            `${env.AUTH_URL}/api/ee/askmcp/callback`,
        );

        const result = await mcpAuth(provider, {
            serverUrl: new URL(mcpServer.serverUrl),
        });

        if (result === 'AUTHORIZED') {
            // Already has valid tokens (e.g., refreshed)
            return { authorizationUrl: null } satisfies ConnectMcpResponse;
        }

        return { authorizationUrl: provider.authorizationUrl! } satisfies ConnectMcpResponse;
    })
    );

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }
  
    return Response.json(result);
});