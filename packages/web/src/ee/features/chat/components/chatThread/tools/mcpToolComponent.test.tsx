import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { DynamicToolUIPart } from 'ai';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { McpToolNameContext } from '@/ee/features/chat/mcpDisplayMetadataContext';
import { McpReconnectContext, McpReconnectContextValue, McpReconnectState } from '@/ee/features/chat/mcpReconnectContext';
import { getMcpToolDisplayParts, McpToolComponent } from './mcpToolComponent';

// React Testing Library's automatic cleanup relies on vitest globals, which
// this project does not enable.
afterEach(cleanup);

describe('getMcpToolDisplayParts', () => {
    test('maps provider-safe MCP tool names back to raw tool names for display', () => {
        expect(getMcpToolDisplayParts(
            'mcp_backstage__catalog_query-catalog-entities',
            {
                'mcp_backstage__catalog_query-catalog-entities': 'catalog.query-catalog-entities',
            },
        )).toEqual({
            serverName: 'backstage',
            toolName: 'catalog.query-catalog-entities',
            displayName: 'backstage: catalog.query-catalog-entities',
        });
    });

    test('falls back to the provider-safe name for older messages without metadata', () => {
        expect(getMcpToolDisplayParts('mcp_backstage__catalog_query-catalog-entities')).toEqual({
            serverName: 'backstage',
            toolName: 'catalog_query-catalog-entities',
            displayName: 'backstage: catalog_query-catalog-entities',
        });
    });
});

describe('McpToolComponent', () => {
    test('renders the raw MCP tool name when display metadata is available', () => {
        const part = {
            type: 'dynamic-tool',
            toolName: 'mcp_backstage__catalog_query-catalog-entities',
            toolCallId: 'tool-call-1',
            state: 'approval-requested',
            input: { filter: 'kind=component' },
        } as DynamicToolUIPart;

        render(
            <McpToolNameContext.Provider value={{
                'mcp_backstage__catalog_query-catalog-entities': 'catalog.query-catalog-entities',
            }}>
                <McpToolComponent part={part} />
            </McpToolNameContext.Provider>
        );

        expect(screen.getByText('backstage: catalog.query-catalog-entities')).toBeTruthy();
        expect(screen.getByText('Request (backstage: catalog.query-catalog-entities)')).toBeTruthy();
        expect(screen.queryByText('backstage: catalog_query-catalog-entities')).toBeNull();
    });
});

const createErrorPart = (toolCallId = 'tool-call-1'): DynamicToolUIPart => ({
    type: 'dynamic-tool',
    toolName: 'mcp_linear__list_issues',
    toolCallId,
    state: 'output-error',
    input: { query: 'open issues' },
    errorText: 'Authentication required: the connection to "Linear" is no longer authorized.',
} as DynamicToolUIPart);

const createReconnectContext = (
    state: McpReconnectState,
    overrides: Partial<McpReconnectContextValue> = {},
): McpReconnectContextValue => ({
    reconnectStates: { [state.serverId]: state },
    isReconnectAllowed: true,
    reconnect: vi.fn(),
    ...overrides,
});

const createReconnectState = (overrides: Partial<McpReconnectState> = {}): McpReconnectState => ({
    serverId: 'server-1',
    serverName: 'Linear',
    toolCallId: 'tool-call-1',
    source: 'tool-call',
    status: 'authentication-required',
    ...overrides,
});

describe('McpToolComponent reconnect recovery UI', () => {
    test('keeps the concise authentication error in details without duplicating the banner action', () => {
        const contextValue = createReconnectContext(createReconnectState());

        render(
            <McpReconnectContext.Provider value={contextValue}>
                <McpToolComponent part={createErrorPart()} />
            </McpReconnectContext.Provider>
        );

        expect(screen.getByText('Linear needs to be reconnected.')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Reconnect Linear' })).toBeNull();
    });

    test('keeps the technical error inside the expandable details section', () => {
        const contextValue = createReconnectContext(createReconnectState());

        render(
            <McpReconnectContext.Provider value={contextValue}>
                <McpToolComponent part={createErrorPart()} />
            </McpReconnectContext.Provider>
        );

        expect(screen.queryByText(/is no longer authorized/)).toBeNull();
        fireEvent.click(screen.getByText('Details'));
        expect(screen.getByText(/is no longer authorized/)).toBeTruthy();
    });

    test('only decorates the tool result whose call failed authentication', () => {
        const contextValue = createReconnectContext(createReconnectState());

        render(
            <McpReconnectContext.Provider value={contextValue}>
                <McpToolComponent part={createErrorPart('tool-call-other')} />
            </McpReconnectContext.Provider>
        );

        expect(screen.queryByText('Linear needs to be reconnected.')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Reconnect Linear' })).toBeNull();
    });

    test('falls back to the plain error rendering without a reconnect provider', () => {
        render(<McpToolComponent part={createErrorPart()} />);

        expect(screen.queryByText('Linear needs to be reconnected.')).toBeNull();
        expect(screen.getByText(/failed:/)).toBeTruthy();
    });
});
