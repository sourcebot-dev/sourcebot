import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
    hasEntitlement: vi.fn(),
    withOptionalAuth: vi.fn(),
}));

vi.mock('@/lib/apiHandler', () => ({
    apiHandler: (handler: unknown) => handler,
}));
vi.mock('@/middleware/sew', () => ({
    sew: (callback: () => unknown) => callback(),
}));
vi.mock('@/lib/entitlements', () => ({
    hasEntitlement: mocks.hasEntitlement,
}));
vi.mock('@/middleware/withAuth', () => ({
    withOptionalAuth: mocks.withOptionalAuth,
}));
vi.mock('@/ee/features/mcp/server', () => ({
    createMcpServer: vi.fn(),
}));
vi.mock('@/lib/utils', () => ({
    isServiceError: () => false,
}));
vi.mock('@sourcebot/shared', () => ({
    env: {
        AUTH_URL: 'https://sourcebot.example.com',
        EXPERIMENT_ASK_GH_ENABLED: 'false',
    },
}));

const { DELETE, POST } = await import('./route');

function createPostRequest(body: unknown) {
    return new NextRequest('https://sourcebot.example.com/api/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasEntitlement.mockResolvedValue(true);
    mocks.withOptionalAuth.mockResolvedValue(new Response(null, { status: 204 }));
});

describe('MCP activity recording', () => {
    test('does not record activity for protocol messages', async () => {
        const response = await POST(createPostRequest({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
                protocolVersion: '2025-11-25',
                capabilities: {},
                clientInfo: { name: 'test-client', version: '1.0.0' },
            },
        }));

        expect(response.status).toBe(204);
        expect(mocks.withOptionalAuth).toHaveBeenCalledWith(
            expect.any(Function),
            { recordActivity: false },
        );
    });

    test('records activity for a valid tool call', async () => {
        const response = await POST(createPostRequest({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {
                name: 'grep',
                arguments: { query: 'activity' },
            },
        }));

        expect(response.status).toBe(204);
        expect(mocks.withOptionalAuth).toHaveBeenCalledWith(
            expect.any(Function),
            { recordActivity: true },
        );
    });

    test('leaves malformed JSON for the transport and does not record activity', async () => {
        const response = await POST(createPostRequest('{"jsonrpc":'));

        expect(response.status).toBe(204);
        expect(mocks.withOptionalAuth).toHaveBeenCalledWith(
            expect.any(Function),
            { recordActivity: false },
        );
    });

    test('does not record activity when closing a session', async () => {
        const response = await DELETE(new NextRequest('https://sourcebot.example.com/api/mcp', {
            method: 'DELETE',
        }));

        expect(response.status).toBe(204);
        expect(mocks.withOptionalAuth).toHaveBeenCalledWith(
            expect.any(Function),
            { recordActivity: false },
        );
    });
});
