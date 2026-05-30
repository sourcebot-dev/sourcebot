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
    WorkspaceAskAgentPage: () => <div>Workspace Ask Sourcebot client</div>,
}));
vi.mock('./workspaceAskAgentEntitlementMessage', () => ({
    WorkspaceAskAgentEntitlementMessage: () => <div>Upgrade to configure Ask Sourcebot connectors</div>,
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

describe('Ask Sourcebot settings page', () => {
    test('renders the connector configuration page when Ask Sourcebot is available', async () => {
        render(await Page({ searchParams: Promise.resolve({}) }));

        expect(screen.getByText('Workspace Ask Sourcebot client')).toBeTruthy();
    });

    test('renders the connector page for teardown when Ask Sourcebot is unavailable but connectors exist', async () => {
        mocks.hasEntitlement.mockResolvedValue(false);
        mocks.authContext.prisma.mcpServer.count.mockResolvedValue(1);

        render(await Page({ searchParams: Promise.resolve({}) }));

        expect(screen.getByText('Workspace Ask Sourcebot client')).toBeTruthy();
        expect(mocks.authContext.prisma.mcpServer.count).toHaveBeenCalledWith({
            where: { orgId: 1 },
        });
    });

    test('renders the upsell message when Ask Sourcebot is unavailable and no connectors exist', async () => {
        mocks.hasEntitlement.mockResolvedValue(false);

        render(await Page({ searchParams: Promise.resolve({}) }));

        expect(screen.getByText('Upgrade to configure Ask Sourcebot connectors')).toBeTruthy();
        expect(screen.queryByText('Workspace Ask Sourcebot client')).toBeNull();
    });
});
