import 'server-only';

import { ErrorCode } from '@/lib/errorCodes';
import type { ServiceError } from '@/lib/serviceError';
import { __unsafePrisma } from '@/prisma';
import { McpServerClientInfoSource, type PrismaClient } from '@sourcebot/db';
import { StatusCodes } from 'http-status-codes';
import { getEnabledMcpScopeNames, normalizeMcpScopeEntries } from './scopeUtils';
import type { McpServerScopeEntry } from './types';

export interface UpdateMcpServerScopesResponse {
    success: true;
    scopes: McpServerScopeEntry[];
    requestedScopes: string[];
    invalidatedConnectionCount: number;
}

type McpServerScopePrismaClient = Pick<PrismaClient, '$transaction'>;

function scopeEntriesEqual(a: McpServerScopeEntry[], b: McpServerScopeEntry[]): boolean {
    return a.length === b.length && a.every((entry, index) => (
        entry.scope === b[index]?.scope && entry.enabled === b[index]?.enabled
    ));
}

export async function updateMcpServerScopeEntries({
    prisma = __unsafePrisma,
    serverId,
    orgId,
    scopes,
}: {
    prisma?: McpServerScopePrismaClient;
    serverId: string;
    orgId: number;
    scopes: McpServerScopeEntry[];
}): Promise<UpdateMcpServerScopesResponse | ServiceError> {
    const normalizedScopes = normalizeMcpScopeEntries(scopes);
    const requestedScopes = getEnabledMcpScopeNames(normalizedScopes);

    return prisma.$transaction(async (tx) => {
        const server = await tx.mcpServer.findFirst({
            where: {
                id: serverId,
                orgId,
            },
            select: {
                id: true,
                clientInfoSource: true,
                scopes: {
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

        const currentScopes = normalizeMcpScopeEntries(server.scopes);
        const currentRequestedScopes = getEnabledMcpScopeNames(currentScopes);
        const scopeEntriesChanged = !scopeEntriesEqual(currentScopes, normalizedScopes);
        const requestedScopesChanged = !scopeEntriesEqual(
            currentRequestedScopes.map((scope) => ({ scope, enabled: true })),
            requestedScopes.map((scope) => ({ scope, enabled: true })),
        );

        if (!scopeEntriesChanged) {
            return {
                success: true,
                scopes: normalizedScopes,
                requestedScopes,
                invalidatedConnectionCount: 0,
            };
        }

        await tx.mcpServerScope.deleteMany({
            where: { mcpServerId: server.id },
        });

        if (normalizedScopes.length > 0) {
            await tx.mcpServerScope.createMany({
                data: normalizedScopes.map((entry) => ({
                    mcpServerId: server.id,
                    scope: entry.scope,
                    enabled: entry.enabled,
                })),
            });
        }

        let invalidatedConnectionCount = 0;
        if (requestedScopesChanged) {
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
            scopes: normalizedScopes,
            requestedScopes,
            invalidatedConnectionCount,
        };
    });
}
