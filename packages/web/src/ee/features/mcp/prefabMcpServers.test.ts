import { describe, expect, test } from 'vitest';
import {
    getAvailablePrefabMcpServers,
    normalizeMcpServerUrlForComparison,
    PREFAB_MCP_SERVERS,
} from './prefabMcpServers';

describe('prefab MCP servers', () => {
    test('ships Slack as the initial prefab server', () => {
        expect(PREFAB_MCP_SERVERS).toEqual([
            {
                id: 'slack',
                name: 'Slack',
                serverUrl: 'https://mcp.slack.com/mcp',
            },
        ]);
    });

    test('keeps prefab servers sorted alphabetically by name', () => {
        const sortedNames = PREFAB_MCP_SERVERS.map((server) => server.name).sort((a, b) => a.localeCompare(b));

        expect(PREFAB_MCP_SERVERS.map((server) => server.name)).toEqual(sortedNames);
    });

    test('hides already configured prefab servers after URL normalization', () => {
        const availableServers = getAvailablePrefabMcpServers(['https://mcp.slack.com/mcp/']);

        expect(availableServers).toEqual([]);
    });

    test('normalizes server URLs for duplicate comparisons', () => {
        expect(normalizeMcpServerUrlForComparison(' HTTPS://MCP.SLACK.COM/mcp/#connect ')).toBe('https://mcp.slack.com/mcp');
    });
});
