import { render, screen } from '@testing-library/react';
import type { DynamicToolUIPart } from 'ai';
import { describe, expect, test } from 'vitest';
import { McpToolNameContext } from '@/ee/features/chat/mcpDisplayMetadataContext';
import { getMcpToolDisplayParts, McpToolComponent } from './mcpToolComponent';

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
