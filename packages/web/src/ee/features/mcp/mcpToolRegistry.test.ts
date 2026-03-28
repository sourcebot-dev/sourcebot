import { expect, test, describe } from 'vitest';
import { buildMcpToolRegistry, searchMcpTools, McpToolRegistryEntry } from './mcpToolRegistry';

// Helper to create a mock tool record matching the MCPClient['tools'] return type.
function createToolRecord(tools: Record<string, { description?: string; execute?: unknown }>) {
    const record: Record<string, { description?: string; execute: unknown; inputSchema: unknown }> = {};
    for (const [name, tool] of Object.entries(tools)) {
        record[name] = {
            description: tool.description,
            execute: tool.execute ?? (() => {}),
            inputSchema: {},
        };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return record as any;
}

describe('buildMcpToolRegistry', () => {
    test('extracts serverName from namespaced tool name', () => {
        const tools = createToolRecord({
            'mcp_linear__list_issues': { description: 'List issues' },
        });

        const registry = buildMcpToolRegistry(tools);

        expect(registry).toEqual([
            { name: 'mcp_linear__list_issues', description: 'List issues', serverName: 'linear' },
        ]);
    });

    test('handles underscores in server name', () => {
        const tools = createToolRecord({
            'mcp_my_server__get_data': { description: 'Get data' },
        });

        const registry = buildMcpToolRegistry(tools);

        expect(registry[0].serverName).toBe('my_server');
    });

    test('defaults missing description to empty string', () => {
        const tools = createToolRecord({
            'mcp_linear__list_issues': { description: undefined },
        });

        const registry = buildMcpToolRegistry(tools);

        expect(registry[0].description).toBe('');
    });

    test('non-matching tool name yields empty serverName', () => {
        const tools = createToolRecord({
            'some_random_tool': { description: 'A tool' },
        });

        const registry = buildMcpToolRegistry(tools);

        expect(registry[0].serverName).toBe('');
    });

    test('empty tools record returns empty array', () => {
        const registry = buildMcpToolRegistry(createToolRecord({}));

        expect(registry).toEqual([]);
    });
});

describe('searchMcpTools', () => {
    // Shared registry for most tests.
    const registry: McpToolRegistryEntry[] = [
        { name: 'mcp_linear__list_issues', description: 'List all issues in a project', serverName: 'linear' },
        { name: 'mcp_linear__create_issue', description: 'Create a new issue', serverName: 'linear' },
        { name: 'mcp_linear__update_issue', description: 'Update an existing issue', serverName: 'linear' },
        { name: 'mcp_github__search_repos', description: 'Search repositories on GitHub', serverName: 'github' },
        { name: 'mcp_pg__run_query', description: 'Run a database query', serverName: 'pg' },
        { name: 'mcp_slack__send_message', description: 'Send a message to a Slack channel', serverName: 'slack' },
        { name: 'mcp_jira__create_ticket', description: 'Create a new Jira ticket', serverName: 'jira' },
    ];

    test('exact name match returns single result', () => {
        const results = searchMcpTools('mcp_linear__list_issues', registry);

        expect(results).toEqual([
            { name: 'mcp_linear__list_issues', description: 'List all issues in a project', serverName: 'linear' },
        ]);
    });

    test('token matching on tool name', () => {
        const results = searchMcpTools('list issues', registry);

        expect(results.length).toBeGreaterThan(0);
        expect(results[0].name).toBe('mcp_linear__list_issues');
    });

    test('synonym expansion: "find" matches tools with "list"', () => {
        const results = searchMcpTools('find issues', registry);

        expect(results.length).toBeGreaterThan(0);
        const names = results.map(r => r.name);
        expect(names).toContain('mcp_linear__list_issues');
    });

    test('synonym expansion: "add" matches tools with "create"', () => {
        const results = searchMcpTools('add ticket', registry);

        expect(results.length).toBeGreaterThan(0);
        const names = results.map(r => r.name);
        expect(names).toContain('mcp_jira__create_ticket');
    });

    test('reverse expansion: canonical "list" expands to synonyms', () => {
        // "list" is canonical and expands to "find", "get", "fetch", "search", etc.
        const results = searchMcpTools('list repos', registry);

        expect(results.length).toBeGreaterThan(0);
        const names = results.map(r => r.name);
        // "search_repos" should match because "list" expands to "search"
        expect(names).toContain('mcp_github__search_repos');
    });

    test('higher-scoring entries come first', () => {
        // "create issue" should score higher for create_issue than for list_issues
        const results = searchMcpTools('create issue', registry);

        expect(results.length).toBeGreaterThan(1);
        // The first result should be the one that matches both tokens
        expect(results[0].name).toBe('mcp_linear__create_issue');
    });

    test('topK limits results', () => {
        const results = searchMcpTools('issue', registry, 2);

        expect(results.length).toBeLessThanOrEqual(2);
    });

    test('default topK is 5', () => {
        // All 7 entries match "mcp" as a substring, but we need tokens > 2 chars
        // Use a query that matches many entries
        const largeRegistry: McpToolRegistryEntry[] = Array.from({ length: 10 }, (_, i) => ({
            name: `mcp_server__tool_${i}`,
            description: `Tool number ${i} for testing`,
            serverName: 'server',
        }));

        const results = searchMcpTools('tool testing', largeRegistry);

        expect(results.length).toBeLessThanOrEqual(5);
    });

    test('short/empty query fallback returns first topK entries', () => {
        // "do it" — all tokens are <= 2 chars after filtering
        const results = searchMcpTools('do it', registry);

        expect(results).toEqual(registry.slice(0, 5));
    });

    test('empty string query fallback returns first topK entries', () => {
        const results = searchMcpTools('', registry);

        expect(results).toEqual(registry.slice(0, 5));
    });

    test('returns empty array when no tokens match', () => {
        const results = searchMcpTools('xyznonexistent', registry);

        expect(results).toEqual([]);
    });

    test('search matches in description, not just name', () => {
        const results = searchMcpTools('database', registry);

        expect(results.length).toBeGreaterThan(0);
        expect(results[0].name).toBe('mcp_pg__run_query');
    });

    test('tokens shorter than 3 chars are filtered out', () => {
        // "do a list" → only "list" survives (length > 2)
        const results = searchMcpTools('do a list', registry);

        expect(results.length).toBeGreaterThan(0);
        // Should still find results via the "list" token
        const names = results.map(r => r.name);
        expect(names).toContain('mcp_linear__list_issues');
    });
});
