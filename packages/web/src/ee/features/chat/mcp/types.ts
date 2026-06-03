import type { McpServerToolPermission } from '@sourcebot/db';

export type { McpServerToolPermission };

export interface McpServerOAuthScopeEntry {
    scope: string;
    enabled: boolean;
}

export interface McpConfigurationServer {
    id: string;
    name: string;
    serverUrl: string;
    sanitizedName: string;
    oauthScopes: McpServerOAuthScopeEntry[];
    faviconUrl: string | undefined;
    savedConnectionCount: number;
    toolUsage: McpServerToolUsageSummary;
}

export type McpConfigurationAllowedMode = 'approved_only';

export interface McpToolUsageEntry {
    toolName: string;
    totalCalls: number;
    usageSharePercent: number;
}

export interface McpServerToolUsageSummary {
    totalCalls: number;
    usedToolCount: number;
    tools: McpToolUsageEntry[];
}

export interface McpServerToolPermissionEntry extends ToolSummary {
    toolName: string;
    permission: McpServerToolPermission;
    callCount: number;
    discovered: boolean;
}

export type McpServerToolPermissionsStatus =
    | { status: 'available'; truncated?: boolean }
    | { status: 'not_connected' }
    | { status: 'error'; reason: ToolMetadataErrorReason };

export interface GetMcpServerToolPermissionsResponse {
    server: {
        id: string;
        name: string;
        serverUrl: string;
        faviconUrl: string | undefined;
        savedConnectionCount: number;
    };
    tools: McpServerToolPermissionEntry[];
    metadataStatus: McpServerToolPermissionsStatus;
}

export interface UpdateMcpServerToolPermissionsResponse {
    success: true;
    updatedToolCount: number;
}

export interface GetMcpConfigurationResponse {
    servers: McpConfigurationServer[];
    allowedMode: McpConfigurationAllowedMode;
    isAskAgentAvailable: boolean;
}

export interface ToolSummary {
    name: string;
    title?: string;
    description?: string;
    permission?: McpServerToolPermission;
    annotations?: {
        readOnlyHint?: boolean;
        destructiveHint?: boolean;
        idempotentHint?: boolean;
    };
}

export type ToolMetadataErrorReason =
    | 'timeout'
    | 'auth_failed'
    | 'connection_failed'
    | 'unsupported'
    | 'unknown';

export type ServerToolsEntry =
    | { status: 'available'; serverId: string; tools: ToolSummary[]; truncated?: boolean }
    | { status: 'error'; serverId: string; reason: ToolMetadataErrorReason };

export type GetMcpToolsResponse = ServerToolsEntry[];
