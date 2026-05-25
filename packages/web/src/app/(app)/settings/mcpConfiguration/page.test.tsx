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
    authenticatedPage: vi.fn((page: (auth: typeof mocks.authContext) => Promise<React.ReactElement>) => () => page(mocks.authContext)),
}));
vi.mock('./mcpConfigurationPage', () => ({
    McpConfigurationPage: () => <div>MCP configuration client</div>,
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

describe('MCP configuration settings page', () => {
    test('renders the client configuration page when OAuth is available', async () => {
        render(await Page({}));

        expect(screen.getByText('MCP configuration client')).toBeTruthy();
    });

    test('renders the client configuration page when OAuth is unavailable but servers exist for cleanup', async () => {
        mocks.hasEntitlement.mockResolvedValue(false);
        mocks.authContext.prisma.mcpServer.count.mockResolvedValue(1);

        render(await Page({}));

        expect(screen.getByText('MCP configuration client')).toBeTruthy();
        expect(mocks.authContext.prisma.mcpServer.count).toHaveBeenCalledWith({
            where: { orgId: 1 },
        });
    });

    test('renders an unavailable message when OAuth is not available and no cleanup is needed', async () => {
        mocks.hasEntitlement.mockResolvedValue(false);

        render(await Page({}));

        expect(screen.getByText('MCP Configuration Is Unavailable')).toBeTruthy();
        expect(screen.queryByText('MCP configuration client')).toBeNull();
    });
});
