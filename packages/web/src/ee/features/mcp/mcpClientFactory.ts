import { createLogger, env, decryptOAuthToken } from '@sourcebot/shared';
import { PrismaOAuthClientProvider } from '@/features/mcp/prismaOAuthClientProvider';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { OAuthTokens } from '@ai-sdk/mcp';
import type { PrismaClient } from '@sourcebot/db';

const logger = createLogger('mcp-client-factory');

export interface McpToolSet {
    serverId: string;
    serverName: string;
    sanitizedName: string;
    serverUrl: string;
    transport: StreamableHTTPClientTransport;
}

/**
 * Returns true if the access token is definitely expired and there is no refresh token to fall back on.
 */
export function isTokenExpiredWithNoRefresh(tokens: OAuthTokens, tokensExpiresAt: Date | null): boolean {
    if (tokens.refresh_token) {
        return false;
    }
    if (!tokensExpiresAt) {
        return false;
    }
    return new Date() > tokensExpiresAt;
}

/**
 * Creates authenticated transports for all external MCP servers the user has valid credentials for.
 * Skips servers with clearly expired tokens and no refresh token.
 * Does NOT connect — connection is deferred to createMCPClient.
 */
export async function getConnectedMcpClients(prisma: PrismaClient, userId: string, orgId: number): Promise<McpToolSet[]> {
    const userServers = await prisma.userMcpServer.findMany({
        where: {
            userId,
            tokens: { not: null },
            server: {
                orgId,
                clientInfo: { not: null },
            },
        },
        select: {
            serverId: true,
            tokens: true,
            tokensExpiresAt: true,
            server: {
                select: {
                    orgId: true,
                    name: true,
                    sanitizedName: true,
                    serverUrl: true,
                },
            },
        },
    });

    const clients: McpToolSet[] = [];

    for (const userServer of userServers) {
        // Skip servers that don't belong to the current org.
        if (userServer.server.orgId !== orgId) {
            continue;
        }

        const serverName = userServer.server.name;

        try {
            const decrypted = decryptOAuthToken(userServer.tokens);
            if (!decrypted) {
                logger.warn(`Could not decrypt tokens for MCP server ${serverName}, skipping.`);
                continue;
            }

            const tokens: OAuthTokens = JSON.parse(decrypted);

            if (isTokenExpiredWithNoRefresh(tokens, userServer.tokensExpiresAt)) {
                logger.warn(`Access token for MCP server ${serverName} is expired and has no refresh token. User ${userId} needs to re-authorize.`);
                continue;
            }

            const provider = new PrismaOAuthClientProvider({
                prisma,
                serverId: userServer.serverId,
                orgId,
                userId,
                callbackUrl: `${env.AUTH_URL}/api/ee/askmcp/callback`,
            });

            const transport = new StreamableHTTPClientTransport(
                new URL(userServer.server.serverUrl),
                { authProvider: provider },
            );

            clients.push({
                serverId: userServer.serverId,
                serverName,
                sanitizedName: userServer.server.sanitizedName,
                serverUrl: userServer.server.serverUrl,
                transport,
            });
        } catch (error) {
            logger.error(`Failed to connect to MCP server ${serverName}:`, error);
        }
    }

    return clients;
}
