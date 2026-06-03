import { apiHandler } from '@/lib/apiHandler';
import { ErrorCode } from '@/lib/errorCodes';
import { serviceErrorResponse, type ServiceError } from '@/lib/serviceError';
import { isServiceError } from '@/lib/utils';
import { withAuth } from '@/middleware/withAuth';
import { withMinimumOrgRole } from '@/middleware/withMinimumOrgRole';
import { hasEntitlement } from '@/lib/entitlements';
import { OAUTH_NOT_SUPPORTED_ERROR_MESSAGE } from '@/ee/features/oauth/constants';
import { getMcpFaviconUrl } from '@/features/chat/mcp/utils';
import { getMcpToolMetadataForServer } from '@/ee/features/chat/mcp/mcpToolMetadata';
import { getDefaultMcpServerToolPermission } from '@/ee/features/chat/mcp/mcpToolPermissions';
import type { GetMcpServerToolPermissionsResponse, McpServerToolPermissionsStatus } from '@/ee/features/chat/mcp/types';
import { __unsafePrisma } from '@/prisma';
import { OrgRole } from '@sourcebot/db';
import { StatusCodes } from 'http-status-codes';
import type { NextRequest } from 'next/server';

function metadataStatusFromEntry(
    entry: Awaited<ReturnType<typeof getMcpToolMetadataForServer>>,
): McpServerToolPermissionsStatus {
    if (!entry) {
        return { status: 'not_connected' };
    }

    if (entry.status === 'error') {
        return {
            status: 'error',
            reason: entry.reason,
        };
    }

    return {
        status: 'available',
        ...(entry.truncated ? { truncated: true } : {}),
    };
}

export const GET = apiHandler(async (
    _request: NextRequest,
    { params }: { params: Promise<{ serverId: string }> },
) => {
    if (!(await hasEntitlement('ask'))) {
        return Response.json(
            { error: 'access_denied', error_description: OAUTH_NOT_SUPPORTED_ERROR_MESSAGE },
            { status: 403 },
        );
    }

    const { serverId } = await params;
    const result = await withAuth(async ({ org, user, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async (): Promise<GetMcpServerToolPermissionsResponse | ServiceError> => {
            const server = await prisma.mcpServer.findFirst({
                where: {
                    id: serverId,
                    orgId: org.id,
                },
                select: {
                    id: true,
                    name: true,
                    serverUrl: true,
                },
            });

            if (!server) {
                return {
                    statusCode: StatusCodes.NOT_FOUND,
                    errorCode: ErrorCode.MCP_SERVER_NOT_FOUND,
                    message: 'Connector not found',
                } satisfies ServiceError;
            }

            const liveEntry = await getMcpToolMetadataForServer(prisma, user.id, org.id, server.id);
            const [toolRows, savedConnectionCount] = await Promise.all([
                __unsafePrisma.mcpServerTool.findMany({
                    where: { mcpServerId: server.id },
                    orderBy: { toolName: 'asc' },
                    select: {
                        toolName: true,
                        permission: true,
                        callCount: true,
                    },
                }),
                __unsafePrisma.userMcpServer.count({
                    where: { serverId: server.id },
                }),
            ]);
            const toolRowByName = new Map(toolRows.map((row) => [row.toolName, row]));
            const liveToolByName = new Map(
                liveEntry?.status === 'available'
                    ? liveEntry.tools.map((tool) => [tool.name, tool] as const)
                    : [],
            );
            const toolNames = Array.from(new Set([
                ...toolRows.map((row) => row.toolName),
                ...liveToolByName.keys(),
            ])).sort();

            return {
                server: {
                    id: server.id,
                    name: server.name,
                    serverUrl: server.serverUrl,
                    faviconUrl: getMcpFaviconUrl(server.serverUrl, server.name),
                    savedConnectionCount,
                },
                tools: toolNames.map((toolName) => {
                    const row = toolRowByName.get(toolName);
                    const metadata = liveToolByName.get(toolName);

                    return {
                        name: metadata?.name ?? toolName,
                        toolName,
                        permission: row?.permission ?? getDefaultMcpServerToolPermission(metadata?.annotations?.readOnlyHint),
                        callCount: row?.callCount ?? 0,
                        discovered: !!metadata,
                        ...(metadata?.title ? { title: metadata.title } : {}),
                        ...(metadata?.description ? { description: metadata.description } : {}),
                        ...(metadata?.annotations ? { annotations: metadata.annotations } : {}),
                    };
                }),
                metadataStatus: metadataStatusFromEntry(liveEntry),
            };
        }));

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result);
});
