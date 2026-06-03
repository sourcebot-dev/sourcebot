import { afterEach, describe, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ConnectorCard } from './connectorCard';
import type { McpServerToolUsageSummary, ServerToolsEntry } from '@/ee/features/chat/mcp/types';

afterEach(() => {
    cleanup();
});

function availableEntry(): Extract<ServerToolsEntry, { status: 'available' }> {
    return {
        status: 'available',
        serverId: 'server-1',
        tools: [
            { name: 'search_issues', title: 'Search issues' },
            { name: 'get_issue' },
            { name: 'create_issue' },
        ],
    };
}

function usageSummary(): McpServerToolUsageSummary {
    return {
        totalCalls: 6,
        usedToolCount: 2,
        tools: [
            { toolName: 'search_issues', totalCalls: 4, usageSharePercent: 66.666 },
            { toolName: 'get_issue', totalCalls: 2, usageSharePercent: 33.333 },
        ],
    };
}

describe('ConnectorCard', () => {
    test('shows only one expanded tools or usage panel at a time', () => {
        render(
            <ConnectorCard
                faviconUrl={undefined}
                name="Linear"
                serverUrl="https://mcp.linear.app/mcp"
                isConnected={true}
                toolEntry={availableEntry()}
                toolUsage={usageSummary()}
                statusBadge={<span>Connected</span>}
                actionButtons={null}
            />,
        );

        const toolsTrigger = screen.getByRole('button', { name: /3 tools/ });
        const usageTrigger = screen.getByRole('button', { name: /6 tool calls/ });

        expect(toolsTrigger.getAttribute('aria-controls')).toBeTruthy();
        expect(usageTrigger.getAttribute('aria-controls')).toBeTruthy();

        fireEvent.click(toolsTrigger);

        expect(screen.getByRole('button', { name: 'Search issues' })).toBeTruthy();
        expect(document.getElementById(toolsTrigger.getAttribute('aria-controls') ?? '')).toBeTruthy();
        expect(screen.queryByText('Lifetime tool usage')).toBeNull();

        fireEvent.click(usageTrigger);

        expect(screen.getByText('Lifetime tool usage')).toBeTruthy();
        expect(document.getElementById(usageTrigger.getAttribute('aria-controls') ?? '')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Search issues' })).toBeNull();

        fireEvent.click(toolsTrigger);

        expect(screen.getByRole('button', { name: 'Search issues' })).toBeTruthy();
        expect(screen.queryByText('Lifetime tool usage')).toBeNull();
    });

    test('hides usage disclosure for connectors with no tool calls', () => {
        render(
            <ConnectorCard
                faviconUrl={undefined}
                name="Linear"
                serverUrl="https://mcp.linear.app/mcp"
                isConnected={true}
                toolEntry={availableEntry()}
                toolUsage={{
                    totalCalls: 0,
                    usedToolCount: 0,
                    tools: [],
                }}
                statusBadge={<span>Connected</span>}
                actionButtons={null}
            />,
        );

        expect(screen.getByRole('button', { name: /3 tools/ })).toBeTruthy();
        expect(screen.queryByRole('button', { name: /0 tool calls/ })).toBeNull();
    });
});
