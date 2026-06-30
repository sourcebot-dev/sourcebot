
export const OAUTH_NOT_SUPPORTED_ERROR_MESSAGE = 'OAuth is not supported on this instance. Please authenticate using a Sourcebot API key instead. See https://docs.sourcebot.dev/docs/features/mcp-server for more information.';

export const UNPERMITTED_SCHEMES = /^(javascript|data|vbscript):/i;

export const SOURCEBOT_OAUTH_SCOPES = [
    "mcp"
] as const;
export type SourcebotOAuthScope = (typeof SOURCEBOT_OAUTH_SCOPES)[number];

export const SOURCEBOT_MCP_OAUTH_SCOPE = 'mcp';
export const DEFAULT_SOURCEBOT_OAUTH_SCOPES = [SOURCEBOT_MCP_OAUTH_SCOPE] as const;
