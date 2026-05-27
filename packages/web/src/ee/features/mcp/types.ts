export interface McpConfigurationServer {
    id: string;
    name: string;
    serverUrl: string;
    sanitizedName: string;
    faviconUrl: string | undefined;
    savedConnectionCount: number;
}

export type McpConfigurationAllowedMode = 'approved_only';

export interface GetMcpConfigurationResponse {
    servers: McpConfigurationServer[];
    totalSavedConnectionCount: number;
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
