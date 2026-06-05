export type McpClientId = 'cursor' | 'vscode' | 'claude-code' | 'codex' | 'windsurf';

export interface McpClient {
    id: McpClientId;
    name: string;
    logoSrc: string;
    logoSrcDark?: string;
}

export const MCP_CLIENTS: McpClient[] = [
    { id: 'vscode', name: 'VS Code', logoSrc: '/vscode.svg' },
    { id: 'cursor', name: 'Cursor', logoSrc: '/cursor_light.svg', logoSrcDark: '/cursor_dark.svg' },
    { id: 'claude-code', name: 'Claude Code', logoSrc: '/claude_code.svg' },
    { id: 'codex', name: 'Codex', logoSrc: '/codex.svg' },
    { id: 'windsurf', name: 'Windsurf', logoSrc: '/windsurf_light.svg', logoSrcDark: '/windsurf_dark.svg' },
];

const NAME_ALIASES: Record<McpClientId, string[]> = {
    'vscode': ['visual studio code', 'vscode', 'vs code'],
    'cursor': ['cursor'],
    'claude-code': ['claude code', 'claude-code'],
    'codex': ['codex'],
    'windsurf': ['windsurf'],
};

function normalize(s: string): string {
    return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function matchKnownClient(name: string): McpClient | null {
    const normalized = normalize(name);
    for (const client of MCP_CLIENTS) {
        const aliases = NAME_ALIASES[client.id].map(normalize);
        if (aliases.some((alias) => normalized === alias || normalized.includes(alias))) {
            return client;
        }
    }
    return null;
}

export type ClientAction =
    | { type: 'deeplink'; href: string }
    | { type: 'command'; command: string }
    | { type: 'docs'; href: string };

export function buildClientAction(clientId: McpClientId, serverUrl: string): ClientAction {
    switch (clientId) {
        case 'cursor': {
            const config = btoa(JSON.stringify({ url: serverUrl }));
            return {
                type: 'deeplink',
                href: `cursor://anysphere.cursor-deeplink/mcp/install?name=sourcebot&config=${config}`,
            };
        }
        case 'vscode': {
            const config = JSON.stringify({ name: 'sourcebot', url: serverUrl });
            return {
                type: 'deeplink',
                href: `vscode:mcp/install?${encodeURIComponent(config)}`,
            };
        }
        case 'claude-code':
            return {
                type: 'command',
                command: `claude mcp add --transport http sourcebot ${serverUrl}`,
            };
        case 'codex':
            return {
                type: 'command',
                command: `codex mcp add sourcebot --url ${serverUrl}`,
            };
        case 'windsurf':
            return {
                type: 'docs',
                href: 'https://docs.windsurf.com/windsurf/cascade/mcp',
            };
    }
}
