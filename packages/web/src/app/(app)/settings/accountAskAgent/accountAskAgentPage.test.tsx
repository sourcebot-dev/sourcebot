import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('@/app/api/(client)/client', () => ({
    getMcpServersWithStatus: vi.fn(),
    getMcpServerTools: vi.fn(),
}));
vi.mock('@/ee/features/mcp/actions', () => ({
    disconnectMcpServer: vi.fn(),
}));

const { AccountAskAgentEmptyState, AccountAskAgentOAuthUnavailableState } = await import('./accountAskAgentPage');

afterEach(() => {
    cleanup();
});

describe('AccountAskAgentEmptyState', () => {
    test('points owners to workspace Ask Agent settings', () => {
        render(<AccountAskAgentEmptyState canManageConnectors={true} />);

        expect(screen.getByText('No connectors configured yet')).toBeTruthy();
        expect(screen.getByText('Open Workspace Ask Agent to approve connectors for your workspace.')).toBeTruthy();
        expect(screen.getByRole('link', { name: /Open Workspace Ask Agent/ }).getAttribute('href')).toBe('/settings/workspaceAskAgent');
    });

    test('tells members to contact an admin', () => {
        render(<AccountAskAgentEmptyState canManageConnectors={false} />);

        expect(screen.getByText('No connectors available')).toBeTruthy();
        expect(screen.getByText(/Contact your workspace admin/)).toBeTruthy();
        expect(screen.queryByRole('link', { name: /Open Workspace Ask Agent/ })).toBeNull();
    });
});

describe('AccountAskAgentOAuthUnavailableState', () => {
    test('points owners to workspace cleanup settings', () => {
        render(<AccountAskAgentOAuthUnavailableState canManageConnectors={true} />);

        expect(screen.getByText('Connector OAuth is unavailable')).toBeTruthy();
        expect(screen.getByRole('link', { name: /Open Workspace Ask Agent/ }).getAttribute('href')).toBe('/settings/workspaceAskAgent');
    });

    test('hides workspace cleanup link from members', () => {
        render(<AccountAskAgentOAuthUnavailableState canManageConnectors={false} />);

        expect(screen.getByText('Connector setup is unavailable on this Sourcebot instance.')).toBeTruthy();
        expect(screen.queryByRole('link', { name: /Open Workspace Ask Agent/ })).toBeNull();
    });
});
