import { createLogger } from '@sourcebot/shared';
import { PrismaOAuthClientProvider } from '@/ee/features/chat/mcp/prismaOAuthClientProvider';
import { getMcpOAuthCallbackUrl } from '@/ee/features/chat/mcp/utils.server';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { PrismaClient } from '@sourcebot/db';
import { getExternalMcpErrorLogFields } from './externalMcpError';
import { getStoredMcpConnectionStatus } from './connectionStatus';
import { getEnabledMcpScopeNames } from './scopeUtils';

const logger = createLogger('mcp-client-factory');

export interface McpToolSet {
    serverId: string;
    serverName: string;
    sanitizedName: string;
    serverUrl: string;
    transport: StreamableHTTPClientTransport;
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
                    scopes: {
                        where: { enabled: true },
                        select: { scope: true, enabled: true },
                    },
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
            const connectionStatus = getStoredMcpConnectionStatus(userServer.tokens, userServer.tokensExpiresAt);
            if (connectionStatus.state === 'not_connected') {
                logger.warn(`Could not decrypt tokens for MCP server ${serverName}, skipping.`);
                continue;
            }

            if (connectionStatus.state === 'expired') {
                logger.warn(`Access token for MCP server ${serverName} is expired and has no refresh token. User ${userId} needs to re-authorize.`);
                continue;
            }

            const provider = new PrismaOAuthClientProvider({
                prisma,
                serverId: userServer.serverId,
                orgId,
                userId,
                callbackUrl: getMcpOAuthCallbackUrl(),
                requestedScopes: getEnabledMcpScopeNames(userServer.server.scopes),
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
            logger.error('Failed to prepare MCP server transport.', {
                serverId: userServer.serverId,
                sanitizedName: userServer.server.sanitizedName,
                error: getExternalMcpErrorLogFields(error),
            });
        }
    }

    return clients;
}
