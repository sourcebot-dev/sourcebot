import { prisma } from '@/prisma';
import { createLogger, env, decryptOAuthToken } from '@sourcebot/shared';
import { PrismaOAuthClientProvider } from '@/features/mcp/prismaOAuthClientProvider';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { OAuthTokens } from '@ai-sdk/mcp';

const logger = createLogger('mcp-client-factory');

export interface McpToolSet {
    serverId: string;
    serverName: string;
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
export async function getConnectedMcpClients(userId: string, orgId: number): Promise<McpToolSet[]> {
    const credentials = await prisma.mcpServerCredential.findMany({
        where: {
            userId,
            tokens: { not: null },
        },
        include: {
            server: {
                include: {
                    userMcpServers: {
                        where: { userId },
                        take: 1,
                    },
                },
            },
        },
    });

    const clients: McpToolSet[] = [];

    for (const credential of credentials) {
        // Skip servers that don't belong to the current org.
        if (credential.server.orgId !== orgId) {
            continue;
        }

        const userServer = credential.server.userMcpServers[0];
        // Skip if the user has removed this server from their list.
        if (!userServer) {
            continue;
        }

        const serverName = userServer.name;

        try {
            const decrypted = decryptOAuthToken(credential.tokens);
            if (!decrypted) {
                logger.warn(`Could not decrypt tokens for MCP server ${serverName}, skipping.`);
                continue;
            }

            const tokens: OAuthTokens = JSON.parse(decrypted);

            if (isTokenExpiredWithNoRefresh(tokens, credential.tokensExpiresAt)) {
                logger.warn(`Access token for MCP server ${serverName} is expired and has no refresh token. User ${userId} needs to re-authorize.`);
                continue;
            }

            const provider = new PrismaOAuthClientProvider(
                credential.serverId,
                userId,
                `${env.AUTH_URL}/api/ee/askmcp/callback`,
            );

            const transport = new StreamableHTTPClientTransport(
                new URL(credential.server.serverUrl),
                { authProvider: provider },
            );

            clients.push({
                serverId: credential.serverId,
                serverName,
                serverUrl: credential.server.serverUrl,
                transport,
            });
        } catch (error) {
            logger.error(`Failed to connect to MCP server ${serverName}:`, error);
        }
    }

    return clients;
}