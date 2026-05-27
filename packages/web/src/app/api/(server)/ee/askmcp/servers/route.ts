import { apiHandler } from '@/lib/apiHandler';
import { serviceErrorResponse } from '@/lib/serviceError';
import { isServiceError } from '@/lib/utils';
import { withAuth } from '@/middleware/withAuth';
import { hasEntitlement } from '@/lib/entitlements';
import { OAUTH_NOT_SUPPORTED_ERROR_MESSAGE } from '@/ee/features/oauth/constants';
import { getMcpFaviconUrl } from '@/ee/features/mcp/utils';
import { getStoredMcpConnectionStatus } from '@/ee/features/mcp/connectionStatus';
import type { NextRequest } from 'next/server';

export interface McpServerWithStatus {
    id: string;
    name: string;
    serverUrl: string;
    sanitizedName: string;
    faviconUrl: string | undefined;
    isConnected: boolean;
    isAuthExpired: boolean;
}

export type GetMcpServersResponse = McpServerWithStatus[];

export const GET = apiHandler(async (_request: NextRequest) => {
    if (!(await hasEntitlement('oauth'))) {
        return Response.json(
            { error: 'access_denied', error_description: OAUTH_NOT_SUPPORTED_ERROR_MESSAGE },
            { status: 403 }
        );
    }

    const result = await withAuth(async ({ org, user, prisma }) => {
        const orgServers = await prisma.mcpServer.findMany({
            where: { orgId: org.id },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                sanitizedName: true,
                serverUrl: true,
            },
        });

        const userServers = await prisma.userMcpServer.findMany({
            where: { userId: user.id },
            select: {
                serverId: true,
                tokens: true,
                tokensExpiresAt: true,
            },
        });
        const userServerByServerId = new Map(userServers.map((us) => [us.serverId, us]));

        return orgServers.map((server): McpServerWithStatus => {
            const userServer = userServerByServerId.get(server.id);
            const faviconUrl = getMcpFaviconUrl(server.serverUrl, server.name);

            let isConnected = false;
            let isAuthExpired = false;

            const connectionStatus = getStoredMcpConnectionStatus(userServer?.tokens, userServer?.tokensExpiresAt ?? null);
            if (connectionStatus.state === 'connected') {
                isConnected = true;
            } else if (connectionStatus.state === 'expired') {
                isAuthExpired = true;
            }

            return {
                id: server.id,
                name: server.name,
                serverUrl: server.serverUrl,
                sanitizedName: server.sanitizedName,
                faviconUrl,
                isConnected,
                isAuthExpired,
            };
        });
    });

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result);
});
