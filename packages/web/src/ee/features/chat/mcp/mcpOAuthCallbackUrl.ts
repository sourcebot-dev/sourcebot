import { env } from '@sourcebot/shared';

export const MCP_OAUTH_CALLBACK_PATH = '/api/ee/askmcp/callback';

export function getMcpOAuthCallbackUrl(): string {
    return `${env.AUTH_URL}${MCP_OAUTH_CALLBACK_PATH}`;
}
