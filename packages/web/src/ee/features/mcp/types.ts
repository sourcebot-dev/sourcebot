export interface McpConfigurationServer {
    id: string;
    name: string;
    serverUrl: string;
    sanitizedName: string;
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

export interface GetMcpConfigurationResponse {
    servers: McpConfigurationServer[];
    allowedMode: McpConfigurationAllowedMode;
    isOAuthAvailable: boolean;
}

export interface ToolSummary {
    name: string;
    title?: string;
    description?: string;
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
