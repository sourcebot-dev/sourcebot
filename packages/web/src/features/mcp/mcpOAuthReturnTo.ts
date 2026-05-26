const MCP_OAUTH_STATE_PREFIX = 'sourcebot_mcp.';
const MCP_OAUTH_STATE_BASE_URL = 'https://sourcebot.local';

function isAllowedMcpOAuthReturnPath(pathname: string): boolean {
    return pathname === '/chat' || pathname.startsWith('/chat/') || pathname === '/settings/mcpServers';
}

export function normalizeMcpOAuthReturnTo(returnTo: unknown): string | undefined {
    if (typeof returnTo !== 'string') {
        return undefined;
    }

    const trimmedReturnTo = returnTo.trim();
    if (!trimmedReturnTo || !trimmedReturnTo.startsWith('/') || trimmedReturnTo.startsWith('//') || trimmedReturnTo.includes('\\')) {
        return undefined;
    }

    try {
        const url = new URL(trimmedReturnTo, MCP_OAUTH_STATE_BASE_URL);
        if (url.origin !== MCP_OAUTH_STATE_BASE_URL || !isAllowedMcpOAuthReturnPath(url.pathname)) {
            return undefined;
        }

        return `${url.pathname}${url.search}`;
    } catch {
        return undefined;
    }
}

export function createMcpOAuthState(nonce: string, returnTo?: string): string {
    const normalizedReturnTo = normalizeMcpOAuthReturnTo(returnTo);
    if (!normalizedReturnTo) {
        return nonce;
    }

    const encoded = Buffer.from(JSON.stringify({
        nonce,
        returnTo: normalizedReturnTo,
    })).toString('base64url');
    return `${MCP_OAUTH_STATE_PREFIX}${encoded}`;
}

export function getMcpOAuthReturnToFromState(state: string | null | undefined): string | undefined {
    if (!state?.startsWith(MCP_OAUTH_STATE_PREFIX)) {
        return undefined;
    }

    try {
        const encoded = state.slice(MCP_OAUTH_STATE_PREFIX.length);
        const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as unknown;
        if (
            typeof payload === 'object' &&
            payload !== null &&
            'returnTo' in payload
        ) {
            return normalizeMcpOAuthReturnTo(payload.returnTo);
        }
    } catch {
        return undefined;
    }

    return undefined;
}
