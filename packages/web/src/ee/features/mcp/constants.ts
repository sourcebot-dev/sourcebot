export const MCP_DOCS_URL = "https://docs.sourcebot.dev/docs/features/mcp-server";
export const PRICING_URL = "https://www.sourcebot.dev/pricing";

// Surfaced to MCP clients (and the programmatic blocking endpoint) when the
// instance is on the free plan. MCP clients render the agent-facing error
// text, so keep this human-readable and point at the upgrade path.
export const MCP_PAID_PLAN_REQUIRED_MESSAGE =
    `The Sourcebot MCP server requires a paid subscription. Upgrade your plan at ${PRICING_URL} to enable it.`;
