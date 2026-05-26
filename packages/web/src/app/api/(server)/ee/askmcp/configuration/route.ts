import { apiHandler } from '@/lib/apiHandler';
import { serviceErrorResponse } from '@/lib/serviceError';
import { isServiceError } from '@/lib/utils';
import { hasEntitlement } from '@/lib/entitlements';
import { withAuth } from '@/middleware/withAuth';
import { withMinimumOrgRole } from '@/middleware/withMinimumOrgRole';
import { __unsafePrisma } from '@/prisma';
import { getMcpFaviconUrl } from '@/ee/features/mcp/utils';
import type { GetMcpConfigurationResponse } from '@/ee/features/mcp/types';
import { OrgRole } from '@sourcebot/db';
import type { NextRequest } from 'next/server';

export const GET = apiHandler(async (_request: NextRequest) => {
    const result = await withAuth(async ({ org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async (): Promise<GetMcpConfigurationResponse> => {
            const isOAuthAvailable = await hasEntitlement('oauth');

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

            const serverIds = orgServers.map((server) => server.id);
            const connectionCounts = serverIds.length === 0
                ? []
                : await __unsafePrisma.userMcpServer.groupBy({
                    by: ['serverId'],
                    where: {
                        serverId: { in: serverIds },
                        tokens: { not: null },
                        server: { orgId: org.id },
                        user: {
                            orgs: {
                                some: { orgId: org.id },
                            },
                        },
                    },
                    _count: { _all: true },
                });
            const countByServerId = new Map(
                connectionCounts.map((row) => [row.serverId, row._count._all]),
            );

            const servers = orgServers.map((server) => {
                const savedConnectionCount = countByServerId.get(server.id) ?? 0;
                return {
                    ...server,
                    faviconUrl: getMcpFaviconUrl(server.serverUrl, server.name),
                    savedConnectionCount,
                };
            });

            return {
                servers,
                totalSavedConnectionCount: servers.reduce((total, server) => total + server.savedConnectionCount, 0),
                allowedMode: 'approved_only',
                isOAuthAvailable,
            };
        }));

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result);
});
