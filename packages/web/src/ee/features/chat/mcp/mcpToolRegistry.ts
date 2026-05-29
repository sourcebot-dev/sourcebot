import type { MCPClient } from '@ai-sdk/mcp';

export interface McpToolRegistryEntry {
    name: string;
    description: string;
    serverName: string;
}

type McpToolRecord = Awaited<ReturnType<MCPClient['tools']>>;

// Synonym map for common action words. Expands query tokens so that e.g.
// "find tickets" matches a tool named "list_issues".
// Module-level constant — built once at server startup, never re-created.
const SYNONYM_MAP: Record<string, string[]> = {
    list:     ['find', 'get', 'fetch', 'retrieve', 'search', 'show', 'query', 'read'],
    create:   ['make', 'add', 'post', 'open', 'new', 'submit', 'write'],
    update:   ['edit', 'modify', 'change', 'patch', 'set'],
    delete:   ['remove', 'destroy', 'archive', 'close'],
    send:     ['post', 'publish', 'notify', 'message'],
    issue:    ['ticket', 'bug', 'task', 'item', 'work'],
    comment:  ['note', 'reply', 'respond'],
    user:     ['member', 'person', 'assignee'],
    project:  ['repo', 'repository', 'workspace'],
};

// Reverse lookup: synonym → canonical token. Built once from SYNONYM_MAP.
const REVERSE_SYNONYMS: Record<string, string> = {};
for (const [canonical, synonyms] of Object.entries(SYNONYM_MAP)) {
    for (const synonym of synonyms) {
        REVERSE_SYNONYMS[synonym] = canonical;
    }
}

function expandTokens(tokens: string[]): string[] {
    const expanded = new Set<string>(tokens);
    for (const token of tokens) {
        const canonical = REVERSE_SYNONYMS[token];
        if (canonical) {
            expanded.add(canonical);
        }
        const synonyms = SYNONYM_MAP[token];
        if (synonyms) {
            for (const s of synonyms) {
                expanded.add(s);
            }
        }
    }
    return Array.from(expanded);
}

export function buildMcpToolRegistry(tools: McpToolRecord): McpToolRegistryEntry[] {
    return Object.entries(tools).map(([name, tool]) => {
        const match = name.match(/^mcp_(.+?)__/);
        const serverName = match ? match[1] : '';
        return {
            name,
            description: tool.description ?? '',
            serverName,
        };
    });
}

export function searchMcpTools(
    query: string,
    registry: McpToolRegistryEntry[],
    topK = 5,
): McpToolRegistryEntry[] {
    // Fast path: if the query is an exact tool name, return it directly.
    const exactMatch = registry.find(e => e.name === query);
    if (exactMatch) {
        return [exactMatch];
    }

    const rawTokens = query
        .toLowerCase()
        .split(/\W+/)
        .filter(t => t.length > 2);

    // If no meaningful tokens remain (e.g. query is "do it" — all tokens <= 2 chars),
    // fall back to returning the first topK tools rather than returning nothing.
    // We could potentially return nothing or return another tool that will help search better
    // in the future.
    if (rawTokens.length === 0) {
        return registry.slice(0, topK);
    }

    const tokens = expandTokens(rawTokens);

    return registry
        .map(entry => {
            const haystack = `${entry.name} ${entry.description}`.toLowerCase();
            const score = tokens.filter(t => haystack.includes(t)).length;
            return { entry, score };
        })
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map(({ entry }) => entry);
}