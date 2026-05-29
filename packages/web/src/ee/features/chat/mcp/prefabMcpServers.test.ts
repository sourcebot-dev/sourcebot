import { describe, expect, test } from 'vitest';
import {
    getAvailablePrefabMcpServers,
    normalizeMcpServerUrlForComparison,
    PREFAB_MCP_SERVERS,
} from './prefabMcpServers';

describe('prefab MCP servers', () => {
    test('ships the supported prefab servers', () => {
        expect(PREFAB_MCP_SERVERS).toEqual([
            {
                id: 'atlassian',
                name: 'Atlassian',
                serverUrl: 'https://mcp.atlassian.com/v1/mcp/authv2',
            },
            {
                id: 'linear',
                name: 'Linear',
                serverUrl: 'https://mcp.linear.app/mcp',
            },
            {
                id: 'posthog',
                name: 'PostHog',
                serverUrl: 'https://mcp.posthog.com/mcp',
            },
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

        expect(availableServers.map((server) => server.id)).toEqual(['atlassian', 'linear', 'posthog']);
    });

    test('hides the Atlassian prefab entry when the shared endpoint is configured', () => {
        const availableServers = getAvailablePrefabMcpServers(['https://mcp.atlassian.com/v1/mcp/authv2/']);

        expect(availableServers.map((server) => server.id)).toEqual(['linear', 'posthog', 'slack']);
    });

    test('normalizes server URLs for duplicate comparisons', () => {
        expect(normalizeMcpServerUrlForComparison(' HTTPS://MCP.SLACK.COM/mcp/#connect ')).toBe('https://mcp.slack.com/mcp');
    });
});
