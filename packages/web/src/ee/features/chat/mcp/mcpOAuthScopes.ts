import 'server-only';

import { ErrorCode } from '@/lib/errorCodes';
import type { ServiceError } from '@/lib/serviceError';
import { __unsafePrisma } from '@/prisma';
import { McpServerClientInfoSource, type PrismaClient } from '@sourcebot/db';
import { StatusCodes } from 'http-status-codes';
import { getEnabledMcpOAuthScopeNames, normalizeMcpOAuthScopeEntries } from './oauthScopeUtils';
import type { McpServerOAuthScopeEntry } from './types';

export interface UpdateMcpServerOAuthScopesResponse {
    success: true;
    oauthScopes: McpServerOAuthScopeEntry[];
    requestedOAuthScopes: string[];
    invalidatedConnectionCount: number;
}

type McpServerOAuthScopePrismaClient = Pick<PrismaClient, '$transaction'>;

function oauthScopeEntriesEqual(a: McpServerOAuthScopeEntry[], b: McpServerOAuthScopeEntry[]): boolean {
    return a.length === b.length && a.every((entry, index) => (
        entry.scope === b[index]?.scope && entry.enabled === b[index]?.enabled
    ));
}

export async function updateMcpServerOAuthScopeEntries({
    prisma = __unsafePrisma,
    serverId,
    orgId,
    oauthScopes,
}: {
    prisma?: McpServerOAuthScopePrismaClient;
    serverId: string;
    orgId: number;
    oauthScopes: McpServerOAuthScopeEntry[];
}): Promise<UpdateMcpServerOAuthScopesResponse | ServiceError> {
    const normalizedOAuthScopes = normalizeMcpOAuthScopeEntries(oauthScopes);
    const requestedOAuthScopes = getEnabledMcpOAuthScopeNames(normalizedOAuthScopes);

    return prisma.$transaction(async (tx) => {
        const server = await tx.mcpServer.findFirst({
            where: {
                id: serverId,
                orgId,
            },
            select: {
                id: true,
                clientInfoSource: true,
                oauthScopes: {
                    select: {
                        scope: true,
                        enabled: true,
                    },
                },
            },
        });

        if (!server) {
            return {
                statusCode: StatusCodes.NOT_FOUND,
                errorCode: ErrorCode.MCP_SERVER_NOT_FOUND,
                message: 'Connector not found',
            } satisfies ServiceError;
        }

        const currentOAuthScopes = normalizeMcpOAuthScopeEntries(server.oauthScopes);
        const currentRequestedOAuthScopes = getEnabledMcpOAuthScopeNames(currentOAuthScopes);
        const oauthScopeEntriesChanged = !oauthScopeEntriesEqual(currentOAuthScopes, normalizedOAuthScopes);
        const requestedOAuthScopesChanged = !oauthScopeEntriesEqual(
            currentRequestedOAuthScopes.map((scope) => ({ scope, enabled: true })),
            requestedOAuthScopes.map((scope) => ({ scope, enabled: true })),
        );

        if (!oauthScopeEntriesChanged) {
            return {
                success: true,
                oauthScopes: normalizedOAuthScopes,
                requestedOAuthScopes,
                invalidatedConnectionCount: 0,
            };
        }

        await tx.mcpServerOAuthScope.deleteMany({
            where: { mcpServerId: server.id },
        });

        if (normalizedOAuthScopes.length > 0) {
            await tx.mcpServerOAuthScope.createMany({
                data: normalizedOAuthScopes.map((entry) => ({
                    mcpServerId: server.id,
                    scope: entry.scope,
                    enabled: entry.enabled,
                })),
            });
        }

        let invalidatedConnectionCount = 0;
        if (requestedOAuthScopesChanged) {
            if (server.clientInfoSource === McpServerClientInfoSource.DYNAMIC) {
                await tx.mcpServer.update({
                    where: { id: server.id },
                    data: { clientInfo: null },
                });
            }

            const result = await tx.userMcpServer.updateMany({
                where: { serverId: server.id },
                data: {
                    tokens: null,
                    tokensExpiresAt: null,
                    codeVerifier: null,
                    state: null,
                },
            });
            invalidatedConnectionCount = result.count;
        }

        return {
            success: true,
            oauthScopes: normalizedOAuthScopes,
            requestedOAuthScopes,
            invalidatedConnectionCount,
        };
    });
}
