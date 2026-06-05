import 'server-only';

import { __unsafePrisma } from '@/prisma';
import {
    McpServerToolPermission,
    type PrismaClient,
} from '@sourcebot/db';

export const DEFAULT_MCP_SERVER_TOOL_PERMISSION = McpServerToolPermission.NEEDS_APPROVAL;

export interface McpServerToolDefaultPermissionInput {
    toolName: string;
    readOnlyHint?: boolean;
}

type McpServerToolRow = {
    mcpServerId: string;
    toolName: string;
    permission: McpServerToolPermission;
};

type McpServerToolPrismaClient = Pick<PrismaClient, 'mcpServerTool'>;

function normalizeToolDefaultInputs(tools: McpServerToolDefaultPermissionInput[]): McpServerToolDefaultPermissionInput[] {
    const toolByName = new Map<string, McpServerToolDefaultPermissionInput>();
    for (const tool of tools) {
        const toolName = tool.toolName.trim();
        if (!toolName) {
            continue;
        }

        const current = toolByName.get(toolName);
        toolByName.set(toolName, {
            toolName,
            readOnlyHint: current?.readOnlyHint === true || tool.readOnlyHint === true,
        });
    }

    return Array.from(toolByName.values()).sort((a, b) => a.toolName.localeCompare(b.toolName));
}

export function getDefaultMcpServerToolPermission(readOnlyHint?: boolean): McpServerToolPermission {
    return readOnlyHint === true
        ? McpServerToolPermission.ALLOWED
        : DEFAULT_MCP_SERVER_TOOL_PERMISSION;
}

export function getMcpServerToolPermission(
    permissionsByToolName: Map<string, McpServerToolPermission>,
    toolName: string,
    readOnlyHint?: boolean,
): McpServerToolPermission {
    return permissionsByToolName.get(toolName) ?? getDefaultMcpServerToolPermission(readOnlyHint);
}

export async function createMissingMcpServerToolRows({
    prisma = __unsafePrisma,
    serverId,
    tools,
}: {
    prisma?: McpServerToolPrismaClient;
    serverId: string;
    tools: McpServerToolDefaultPermissionInput[];
}) {
    const normalizedTools = normalizeToolDefaultInputs(tools);
    if (normalizedTools.length === 0) {
        return;
    }

    await prisma.mcpServerTool.createMany({
        data: normalizedTools.map((tool) => ({
            mcpServerId: serverId,
            toolName: tool.toolName,
            permission: getDefaultMcpServerToolPermission(tool.readOnlyHint),
        })),
        skipDuplicates: true,
    });
}

export async function getMcpServerToolPermissionsByServerId({
    prisma = __unsafePrisma,
    serverIds,
}: {
    prisma?: McpServerToolPrismaClient;
    serverIds: string[];
}): Promise<Map<string, Map<string, McpServerToolPermission>>> {
    const uniqueServerIds = Array.from(new Set(serverIds));
    if (uniqueServerIds.length === 0) {
        return new Map();
    }

    const rows: McpServerToolRow[] = await prisma.mcpServerTool.findMany({
        where: {
            mcpServerId: { in: uniqueServerIds },
        },
        select: {
            mcpServerId: true,
            toolName: true,
            permission: true,
        },
    });

    const permissionsByServerId = new Map<string, Map<string, McpServerToolPermission>>();
    for (const row of rows) {
        const permissionsByToolName = permissionsByServerId.get(row.mcpServerId) ?? new Map();
        permissionsByToolName.set(row.toolName, row.permission);
        permissionsByServerId.set(row.mcpServerId, permissionsByToolName);
    }

    return permissionsByServerId;
}
