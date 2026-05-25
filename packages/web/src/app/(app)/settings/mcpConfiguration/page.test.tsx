import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type React from 'react';

const mocks = vi.hoisted(() => ({
    hasEntitlement: vi.fn(),
}));

vi.mock('@/lib/entitlements', () => ({
    hasEntitlement: mocks.hasEntitlement,
}));
vi.mock('@/middleware/authenticatedPage', () => ({
    authenticatedPage: vi.fn((page: () => Promise<React.ReactElement>) => page),
}));
vi.mock('./mcpConfigurationPage', () => ({
    McpConfigurationPage: () => <div>MCP configuration client</div>,
}));

const { default: Page } = await import('./page');

beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasEntitlement.mockResolvedValue(true);
});

afterEach(() => {
    cleanup();
});

describe('MCP configuration settings page', () => {
    test('renders the client configuration page when OAuth is available', async () => {
        render(await Page({}));

        expect(screen.getByText('MCP configuration client')).toBeTruthy();
    });

    test('renders an unavailable message when OAuth is not available', async () => {
        mocks.hasEntitlement.mockResolvedValue(false);

        render(await Page({}));

        expect(screen.getByText('MCP Configuration Is Unavailable')).toBeTruthy();
        expect(screen.queryByText('MCP configuration client')).toBeNull();
    });
});
