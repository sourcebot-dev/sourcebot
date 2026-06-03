import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
    authContext: undefined as unknown,
    hasEntitlement: vi.fn(),
    getMcpToolMetadata: vi.fn(),
}));

vi.mock('@/lib/posthog', () => ({
    captureEvent: vi.fn(),
}));
vi.mock('@/lib/entitlements', () => ({
    hasEntitlement: mocks.hasEntitlement,
}));
vi.mock('@/middleware/withAuth', () => ({
    withAuth: vi.fn((callback: (context: unknown) => unknown) => callback(mocks.authContext)),
}));
vi.mock('@/ee/features/chat/mcp/mcpToolMetadata', () => ({
    getMcpToolMetadata: mocks.getMcpToolMetadata,
}));

const { GET } = await import('./route');

function createRequest() {
    return new NextRequest('https://sourcebot.example.com/api/ee/askmcp/tools', { method: 'GET' });
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasEntitlement.mockResolvedValue(true);
    mocks.getMcpToolMetadata.mockResolvedValue([]);
});

describe('GET /api/ee/askmcp/tools', () => {
    test('returns tool metadata for the authenticated viewer without owner-only gating', async () => {
        const prisma = {};
        mocks.authContext = {
            org: { id: 1 },
            user: { id: 'user-1' },
            role: 'MEMBER',
            prisma,
        };
        mocks.getMcpToolMetadata.mockResolvedValue([
            {
                status: 'available',
                serverId: 'server-1',
                tools: [{ name: 'search' }],
            },
        ]);

        const response = await GET(createRequest());
        const body = await response.json();

        expect(mocks.getMcpToolMetadata).toHaveBeenCalledWith(prisma, 'user-1', 1);
        expect(body).toEqual([
            {
                status: 'available',
                serverId: 'server-1',
                tools: [{ name: 'search' }],
            },
        ]);
    });

    test('returns access_denied when Ask Agent is unavailable', async () => {
        mocks.hasEntitlement.mockResolvedValue(false);

        const response = await GET(createRequest());
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toMatchObject({ error: 'access_denied' });
        expect(mocks.getMcpToolMetadata).not.toHaveBeenCalled();
    });
});
