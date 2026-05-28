export interface PrefabMcpServer {
    id: string;
    name: string;
    serverUrl: string;
}

const prefabMcpServers = [
    {
        id: "atlassian",
        name: "Atlassian",
        serverUrl: "https://mcp.atlassian.com/v1/mcp/authv2",
    },
    {
        id: "linear",
        name: "Linear",
        serverUrl: "https://mcp.linear.app/mcp",
    },
    {
        id: "posthog",
        name: "PostHog",
        serverUrl: "https://mcp.posthog.com/mcp",
    },
    {
        id: "slack",
        name: "Slack",
        serverUrl: "https://mcp.slack.com/mcp",
    },
] satisfies PrefabMcpServer[];

export const PREFAB_MCP_SERVERS = [...prefabMcpServers].sort((a, b) => a.name.localeCompare(b.name));

export function normalizeMcpServerUrlForComparison(serverUrl: string): string {
    const trimmedServerUrl = serverUrl.trim();

    try {
        const url = new URL(trimmedServerUrl);
        url.hash = "";
        return url.toString().replace(/\/$/, "");
    } catch {
        return trimmedServerUrl.toLowerCase().replace(/\/$/, "");
    }
}

export function getAvailablePrefabMcpServers(configuredServerUrls: string[]): PrefabMcpServer[] {
    const configuredServerUrlSet = new Set(
        configuredServerUrls.map((serverUrl) => normalizeMcpServerUrlForComparison(serverUrl)),
    );

    return PREFAB_MCP_SERVERS.filter((server) => (
        !configuredServerUrlSet.has(normalizeMcpServerUrlForComparison(server.serverUrl))
    ));
}
