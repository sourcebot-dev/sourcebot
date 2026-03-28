/**
 * Sanitizes an MCP server name into a lowercase alphanumeric string suitable
 * for use as a tool-name prefix (e.g. "My Server!" → "my_server_").
 *
 * This is used to namespace MCP tools (mcp_{sanitizedName}__{toolName}) and
 * to key favicon maps. Must be kept consistent everywhere — collisions on
 * this value are prevented at server-creation time.
 */
export function sanitizeMcpServerName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
}