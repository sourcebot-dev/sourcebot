import { apiHandler } from '@/lib/apiHandler';
import { serviceErrorResponse } from '@/lib/serviceError';
import { isServiceError } from '@/lib/utils';
import { hasEntitlement } from '@/lib/entitlements';
import { withAuth } from '@/middleware/withAuth';
import { withMinimumOrgRole } from '@/middleware/withMinimumOrgRole';
import { __unsafePrisma } from '@/prisma';
import { getMcpFaviconUrl } from '@/features/chat/mcp/utils';
import type { GetMcpConfigurationResponse, McpServerToolUsageSummary } from '@/ee/features/chat/mcp/types';
import { OrgRole } from '@sourcebot/db';
import type { NextRequest } from 'next/server';

export const GET = apiHandler(async (_request: NextRequest) => {
    const result = await withAuth(async ({ org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async (): Promise<GetMcpConfigurationResponse> => {
            const isAskAgentAvailable = await hasEntitlement('ask');

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
            const toolCallCountRows = serverIds.length === 0
                ? []
                : await __unsafePrisma.mcpServerToolCallCount.findMany({
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
                });
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
                allowedMode: 'approved_only',
                isAskAgentAvailable,
            };
        }));

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result);
});
