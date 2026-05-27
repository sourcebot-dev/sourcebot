import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type React from 'react';

const mocks = vi.hoisted(() => ({
    authContext: {
        org: { id: 1 },
        prisma: {
            mcpServer: {
                count: vi.fn(),
            },
        },
    },
    hasEntitlement: vi.fn(),
}));

vi.mock('@/lib/entitlements', () => ({
    hasEntitlement: mocks.hasEntitlement,
}));
vi.mock('@/middleware/authenticatedPage', () => ({
    authenticatedPage: vi.fn((page: (auth: typeof mocks.authContext, props: { searchParams: Promise<Record<string, string>> }) => Promise<React.ReactElement>) =>
        (props: { searchParams: Promise<Record<string, string>> }) => page(mocks.authContext, props)),
}));
vi.mock('./workspaceAskAgentPage', () => ({
    WorkspaceAskAgentPage: () => <div>Workspace Ask Agent client</div>,
}));

const { default: Page } = await import('./page');

beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasEntitlement.mockResolvedValue(true);
    mocks.authContext.prisma.mcpServer.count.mockResolvedValue(0);
});

afterEach(() => {
    cleanup();
});

describe('Ask Agent settings page', () => {
    test('renders the client configuration page when OAuth is available', async () => {
        render(await Page({ searchParams: Promise.resolve({}) }));

        expect(screen.getByText('Workspace Ask Agent client')).toBeTruthy();
    });

    test('renders the client configuration page when OAuth is unavailable but servers exist for cleanup', async () => {
        mocks.hasEntitlement.mockResolvedValue(false);
        mocks.authContext.prisma.mcpServer.count.mockResolvedValue(1);

        render(await Page({ searchParams: Promise.resolve({}) }));

        expect(screen.getByText('Workspace Ask Agent client')).toBeTruthy();
        expect(mocks.authContext.prisma.mcpServer.count).toHaveBeenCalledWith({
            where: { orgId: 1 },
        });
    });

    test('renders an unavailable message when OAuth is not available and no cleanup is needed', async () => {
        mocks.hasEntitlement.mockResolvedValue(false);

        render(await Page({ searchParams: Promise.resolve({}) }));

        expect(screen.getByText('Ask Agent Connectors Are Unavailable')).toBeTruthy();
        expect(screen.queryByText('Workspace Ask Agent client')).toBeNull();
    });
});
