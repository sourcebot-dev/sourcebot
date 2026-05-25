import { afterEach, describe, expect, test } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { McpServersEmptyState } from './mcpServersPage';

afterEach(() => {
    cleanup();
});

describe('McpServersEmptyState', () => {
    test('points owners to workspace MCP configuration', () => {
        render(<McpServersEmptyState canManageMcpServers={true} />);

        expect(screen.getByText('No MCP servers configured yet')).toBeTruthy();
        expect(screen.getByText(/Go to Workspace MCP Configuration/)).toBeTruthy();
        expect(screen.getByRole('link', { name: /Open MCP Configuration/ }).getAttribute('href')).toBe('/settings/mcpConfiguration');
    });

    test('tells members to contact an admin', () => {
        render(<McpServersEmptyState canManageMcpServers={false} />);

        expect(screen.getByText('No MCP servers available')).toBeTruthy();
        expect(screen.getByText(/Contact your workspace admin/)).toBeTruthy();
        expect(screen.queryByRole('link', { name: /Open MCP Configuration/ })).toBeNull();
    });
});
