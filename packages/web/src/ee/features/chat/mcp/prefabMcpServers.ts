export interface PrefabMcpServer {
    id: string;
    name: string;
    serverUrl: string;
    descriptionOverride?: string;
}

export const DEFAULT_STATIC_OAUTH_DESCRIPTION =
    "This connector does not advertise dynamic client registration. Provide OAuth client credentials from a pre-registered app before members can connect to it.";

export const OAUTH_REDIRECT_URL_PLACEHOLDER = "{{REDIRECT_URL}}";

const prefabMcpServers = [
    {
        id: "atlassian",
        name: "Atlassian",
        serverUrl: "https://mcp.atlassian.com/v1/mcp/authv2",
    },
    {
        id: "betterstack",
        name: "Better Stack",
        serverUrl: "https://mcp.betterstack.com",
    },
    {
        id: "circleback",
        name: "Circleback",
        serverUrl: "https://circleback.ai/api/mcp",
    },
    {
        id: "github",
        name: "GitHub",
        serverUrl: "https://api.githubcopilot.com/mcp/",
    },
    {
        id: "gitlab",
        name: "GitLab",
        serverUrl: "https://gitlab.com/api/v4/mcp",
    },
    {
        id: "linear",
        name: "Linear",
        serverUrl: "https://mcp.linear.app/mcp",
    },
    {
        id: "notion",
        name: "Notion",
        serverUrl: "https://mcp.notion.com/mcp",
    },
    {
        id: "posthog",
        name: "PostHog",
        serverUrl: "https://mcp.posthog.com/mcp",
    },
    {
        id: "sentry",
        name: "Sentry",
        serverUrl: "https://mcp.sentry.dev/mcp",
    },
    {
        id: "slack",
        name: "Slack",
        serverUrl: "https://mcp.slack.com/mcp",
        descriptionOverride:
            "Slack doesn't support dynamic client registration, so you'll need to create an app in your Slack workspace and provide Sourcebot a Client ID and Secret. These are stored encrypted within your Sourcebot deployment.\n\nVisit [this page](https://api.slack.com/apps) to create a Slack app. Set the redirect URL (under OAuth & Permissions) to `{{REDIRECT_URL}}`",
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

export function getStaticOAuthDescription(serverUrl: string, redirectUrl?: string): string {
    const normalizedServerUrl = normalizeMcpServerUrlForComparison(serverUrl);
    const prefabServer = PREFAB_MCP_SERVERS.find((server) => (
        normalizeMcpServerUrlForComparison(server.serverUrl) === normalizedServerUrl
    ));

    const description = prefabServer?.descriptionOverride ?? DEFAULT_STATIC_OAUTH_DESCRIPTION;

    if (redirectUrl) {
        return description.replaceAll(OAUTH_REDIRECT_URL_PLACEHOLDER, redirectUrl);
    }

    return description;
}

export function getAvailablePrefabMcpServers(configuredServerUrls: string[]): PrefabMcpServer[] {
    const configuredServerUrlSet = new Set(
        configuredServerUrls.map((serverUrl) => normalizeMcpServerUrlForComparison(serverUrl)),
    );

    return PREFAB_MCP_SERVERS.filter((server) => (
        !configuredServerUrlSet.has(normalizeMcpServerUrlForComparison(server.serverUrl))
    ));
}
