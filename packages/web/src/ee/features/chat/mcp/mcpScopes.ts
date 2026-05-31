import 'server-only';

import { ErrorCode } from '@/lib/errorCodes';
import type { ServiceError } from '@/lib/serviceError';
import { __unsafePrisma } from '@/prisma';
import { McpServerClientInfoSource, type PrismaClient } from '@sourcebot/db';
import { StatusCodes } from 'http-status-codes';

export interface UpdateMcpServerScopesResponse {
    success: true;
    requestedScopes: string[];
    invalidatedConnectionCount: number;
}

type McpServerScopePrismaClient = Pick<PrismaClient, '$transaction'>;

export function normalizeMcpRequestedScopes(scopes: string[]): string[] {
    return [...new Set(scopes.map((scope) => scope.trim()).filter(Boolean))]
        .sort();
}

function normalizedScopesEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((scope, index) => scope === b[index]);
}

export async function updateMcpServerRequestedScopes({
    prisma = __unsafePrisma,
    serverId,
    orgId,
    requestedScopes,
}: {
    prisma?: McpServerScopePrismaClient;
    serverId: string;
    orgId: number;
    requestedScopes: string[];
}): Promise<UpdateMcpServerScopesResponse | ServiceError> {
    const normalizedRequestedScopes = normalizeMcpRequestedScopes(requestedScopes);

    return prisma.$transaction(async (tx) => {
        const server = await tx.mcpServer.findFirst({
            where: {
                id: serverId,
                orgId,
            },
            select: {
                id: true,
                requestedScopes: true,
                clientInfoSource: true,
            },
        });

        if (!server) {
            return {
                statusCode: StatusCodes.NOT_FOUND,
                errorCode: ErrorCode.MCP_SERVER_NOT_FOUND,
                message: 'Connector not found',
            } satisfies ServiceError;
        }

        const currentRequestedScopes = normalizeMcpRequestedScopes(server.requestedScopes);
        if (normalizedScopesEqual(currentRequestedScopes, normalizedRequestedScopes)) {
            return {
                success: true,
                requestedScopes: normalizedRequestedScopes,
                invalidatedConnectionCount: 0,
            };
        }

        await tx.mcpServer.update({
            where: { id: server.id },
            data: {
                requestedScopes: normalizedRequestedScopes,
                ...(server.clientInfoSource === McpServerClientInfoSource.DYNAMIC ? { clientInfo: null } : {}),
            },
        });

        const result = await tx.userMcpServer.updateMany({
            where: { serverId: server.id },
            data: {
                tokens: null,
                tokensExpiresAt: null,
                codeVerifier: null,
                state: null,
            },
        });

        return {
            success: true,
            requestedScopes: normalizedRequestedScopes,
            invalidatedConnectionCount: result.count,
        };
    });
}
