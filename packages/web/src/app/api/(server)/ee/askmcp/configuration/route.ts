import { apiHandler } from '@/lib/apiHandler';
import { serviceErrorResponse } from '@/lib/serviceError';
import { isServiceError } from '@/lib/utils';
import { hasEntitlement } from '@/lib/entitlements';
import { withAuth } from '@/middleware/withAuth';
import { withMinimumOrgRole } from '@/middleware/withMinimumOrgRole';
import { __unsafePrisma } from '@/prisma';
import { getMcpFaviconUrl } from '@/ee/features/mcp/utils';
import type { GetMcpConfigurationResponse, McpServerToolUsageSummary } from '@/ee/features/mcp/types';
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

            const toolCallCountWhere = {
                mcpServerId: { in: serverIds },
                mcpServer: { orgId: org.id },
                count: { gt: 0 },
            };
            // The grouped query is capped to the top 2 for display, so keep a separate aggregate
            // for the deployment-wide total used in percentages and footer labels.
            const [topConnectorCounts, grandTotalToolCallsResult, toolCallCountRows] = serverIds.length === 0
                ? [[], { _sum: { count: null } }, []]
                : await Promise.all([
                    __unsafePrisma.mcpServerToolCallCount.groupBy({
                        by: ['mcpServerId'],
                        where: toolCallCountWhere,
                        _sum: { count: true },
                        orderBy: { _sum: { count: 'desc' } },
                        take: 2,
                    }),
                    __unsafePrisma.mcpServerToolCallCount.aggregate({
                        where: toolCallCountWhere,
                        _sum: { count: true },
                    }),
                    __unsafePrisma.mcpServerToolCallCount.findMany({
                        where: toolCallCountWhere,
                        orderBy: [
                            { mcpServerId: 'asc' },
                            { count: 'desc' },
                        ],
                        select: {
                            mcpServerId: true,
                            toolName: true,
                            count: true,
                        },
                    }),
                ]);
            const grandTotalToolCalls = grandTotalToolCallsResult._sum.count ?? 0;
            const serverById = new Map(orgServers.map((server) => [server.id, server]));
            const toolUsageByServerId = new Map<string, McpServerToolUsageSummary>();

            for (const row of toolCallCountRows) {
                const current = toolUsageByServerId.get(row.mcpServerId) ?? {
                    totalCalls: 0,
                    usedToolCount: 0,
                    tools: [],
                };

                current.totalCalls += row.count;
                current.usedToolCount += 1;
                current.tools.push({
                    toolName: row.toolName,
                    totalCalls: row.count,
                    usageSharePercent: 0,
                });
                toolUsageByServerId.set(row.mcpServerId, current);
            }

            for (const usage of toolUsageByServerId.values()) {
                usage.tools = usage.tools.map((tool) => ({
                    ...tool,
                    usageSharePercent: usage.totalCalls > 0
                        ? (tool.totalCalls / usage.totalCalls) * 100
                        : 0,
                }));
            }

            const topConnectors = topConnectorCounts.flatMap((row) => {
                const server = serverById.get(row.mcpServerId);
                if (!server) {
                    return [];
                }

                const totalCalls = row._sum.count ?? 0;
                return [{
                    serverId: server.id,
                    serverName: server.name,
                    faviconUrl: getMcpFaviconUrl(server.serverUrl, server.name),
                    totalCalls,
                    usageSharePercent: grandTotalToolCalls > 0
                        ? (totalCalls / grandTotalToolCalls) * 100
                        : 0,
                }];
            });

            const servers = orgServers.map((server) => {
                const savedConnectionCount = countByServerId.get(server.id) ?? 0;
                return {
                    ...server,
                    faviconUrl: getMcpFaviconUrl(server.serverUrl, server.name),
                    savedConnectionCount,
                    toolUsage: toolUsageByServerId.get(server.id) ?? {
                        totalCalls: 0,
                        usedToolCount: 0,
                        tools: [],
                    },
                };
            });

            return {
                servers,
                totalSavedConnectionCount: servers.reduce((total, server) => total + server.savedConnectionCount, 0),
                topConnectors,
                grandTotalToolCalls,
                allowedMode: 'approved_only',
                isOAuthAvailable,
            };
        }));

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result);
});
