import { apiHandler } from '@/lib/apiHandler';
import { serviceErrorResponse } from '@/lib/serviceError';
import { isServiceError } from '@/lib/utils';
import { withAuthV2 } from '@/withAuthV2';
import { hasEntitlement } from '@sourcebot/shared';
import { decryptOAuthToken } from '@sourcebot/shared';
import { sanitizeMcpServerName } from '@/ee/features/mcp/utils';
import { OAUTH_NOT_SUPPORTED_ERROR_MESSAGE } from '@/ee/features/oauth/constants';
import type { OAuthTokens } from '@ai-sdk/mcp';

export interface McpServerWithStatus {
    id: string;
    name: string;
    serverUrl: string;
    sanitizedName: string;
    faviconUrl: string;
    isConnected: boolean;
    isAuthExpired: boolean;
}

export type GetMcpServersResponse = McpServerWithStatus[];

export const GET = apiHandler(async () => {
    if (!hasEntitlement('oauth')) {
        return Response.json(
            { error: 'access_denied', error_description: OAUTH_NOT_SUPPORTED_ERROR_MESSAGE },
            { status: 403 }
        );
    }

    const result = await withAuthV2(async ({ user, prisma }) => {
        const userServers = await prisma.userMcpServer.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            include: {
                server: {
                    include: {
                        credentials: {
                            where: { userId: user.id },
                            take: 1,
                        },
                    },
                },
            },
        });

        return userServers.map((us): McpServerWithStatus => {
            const credential = us.server.credentials[0] ?? null;
            const sanitizedName = sanitizeMcpServerName(us.name);
            const origin = new URL(us.server.serverUrl).origin;
            const faviconUrl = `https://www.google.com/s2/favicons?domain=${origin}&sz=32`;

            let isConnected = false;
            let isAuthExpired = false;

            if (credential?.tokens) {
                try {
                    const decrypted = decryptOAuthToken(credential.tokens);
                    if (decrypted) {
                        const tokens: OAuthTokens = JSON.parse(decrypted);
                        if (tokens.refresh_token || !credential.tokensExpiresAt) {
                            isConnected = true;
                        } else if (new Date() > credential.tokensExpiresAt) {
                            isAuthExpired = true;
                        } else {
                            isConnected = true;
                        }
                    }
                } catch {
                    // treat as not connected if decryption fails
                }
            }

            return {
                id: us.server.id,
                name: us.name,
                serverUrl: us.server.serverUrl,
                sanitizedName,
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