import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('@/app/api/(client)/client', () => ({
    getMcpServersWithStatus: vi.fn(),
    getMcpServerTools: vi.fn(),
}));
vi.mock('@/ee/features/chat/mcp/actions', () => ({
    disconnectMcpServer: vi.fn(),
}));
vi.mock('@/ee/features/chat/skills/actions', () => ({
    deletePersonalAgentSkill: vi.fn(),
}));

const { AccountAskAgentEmptyState } = await import('./accountAskAgentPage');

afterEach(() => {
    cleanup();
});

describe('AccountAskAgentEmptyState', () => {
    test('points owners to workspace Ask Sourcebot settings', () => {
        render(<AccountAskAgentEmptyState canManageConnectors={true} />);

        expect(screen.getByText('No connectors configured yet')).toBeTruthy();
        expect(screen.getByText('Open Workspace Ask Sourcebot to approve connectors for your workspace.')).toBeTruthy();
        expect(screen.getByRole('link', { name: /Open Workspace Ask Sourcebot/ }).getAttribute('href')).toBe('/settings/workspaceAskAgent');
    });

    test('tells members to contact an admin', () => {
        render(<AccountAskAgentEmptyState canManageConnectors={false} />);

        expect(screen.getByText('No connectors available')).toBeTruthy();
        expect(screen.getByText(/Contact your workspace admin/)).toBeTruthy();
        expect(screen.queryByRole('link', { name: /Open Workspace Ask Sourcebot/ })).toBeNull();
    });
});
