export interface PrefabMcpServer {
    id: string;
    name: string;
    serverUrl: string;
    // Markdown copy shown in the "OAuth Client Credentials Required" dialog when a
    // connector doesn't support dynamic client registration. Falls back to
    // DEFAULT_STATIC_OAUTH_DESCRIPTION when omitted.
    staticOAuthDescription?: string;
}

// Default copy used when a connector requires manually-provided OAuth client
// credentials and doesn't specify its own `staticOAuthDescription`.
export const DEFAULT_STATIC_OAUTH_DESCRIPTION =
    "This connector does not advertise dynamic client registration. Provide OAuth client credentials from a pre-registered app before members can connect to it.";

// Token in `staticOAuthDescription` copy that `getStaticOAuthDescription`
// replaces with the deployment's actual OAuth redirect URL.
export const OAUTH_REDIRECT_URL_PLACEHOLDER = "{{REDIRECT_URL}}";

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
        staticOAuthDescription:
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

// Resolves the OAuth client credentials dialog copy for a connector, using the
// matching prefab server's override when one exists and falling back to the
// default copy otherwise. Substitutes OAUTH_REDIRECT_URL_PLACEHOLDER with the
// deployment's actual OAuth redirect URL when provided.
export function getStaticOAuthDescription(serverUrl: string, redirectUrl?: string): string {
    const normalizedServerUrl = normalizeMcpServerUrlForComparison(serverUrl);
    const prefabServer = PREFAB_MCP_SERVERS.find((server) => (
        normalizeMcpServerUrlForComparison(server.serverUrl) === normalizedServerUrl
    ));

    const description = prefabServer?.staticOAuthDescription ?? DEFAULT_STATIC_OAUTH_DESCRIPTION;

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
