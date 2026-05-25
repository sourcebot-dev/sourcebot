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
}
