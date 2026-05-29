import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
    authContext: undefined as unknown,
    hasEntitlement: vi.fn(),
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
vi.mock('@sourcebot/shared', () => ({
    decryptOAuthToken: vi.fn((value: string) => value),
}));

const { GET } = await import('./route');

function createRequest() {
    return new NextRequest('https://sourcebot.example.com/api/ee/askmcp/servers', { method: 'GET' });
}

function createPrismaMock() {
    return {
        mcpServer: {
            findMany: vi.fn().mockResolvedValue([
                {
                    id: 'server-1',
                    name: 'Linear',
                    sanitizedName: 'linear',
                    serverUrl: 'https://mcp.linear.app/mcp',
                },
                {
                    id: 'server-2',
                    name: 'Sentry',
                    sanitizedName: 'sentry',
                    serverUrl: 'https://mcp.sentry.dev/mcp',
                },
                {
                    id: 'server-3',
                    name: 'GitHub',
                    sanitizedName: 'github',
                    serverUrl: 'https://api.githubcopilot.com/mcp',
                },
            ]),
        },
        userMcpServer: {
            findMany: vi.fn().mockResolvedValue([
                {
                    serverId: 'server-1',
                    tokens: JSON.stringify({ access_token: 'token', token_type: 'Bearer' }),
                    tokensExpiresAt: null,
                },
                {
                    serverId: 'server-3',
                    tokens: JSON.stringify({ access_token: 'expired-token', token_type: 'Bearer' }),
                    tokensExpiresAt: new Date('2020-01-01T00:00:00.000Z'),
                },
            ]),
        },
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasEntitlement.mockResolvedValue(true);
});

describe('GET /api/ee/askmcp/servers', () => {
    test('returns an empty array when the oauth entitlement is not granted', async () => {
        mocks.hasEntitlement.mockResolvedValue(false);
        const prisma = createPrismaMock();
        mocks.authContext = {
            org: { id: 1 },
            user: { id: 'user-1' },
            prisma,
        };

        const response = await GET(createRequest());
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual([]);
        expect(prisma.mcpServer.findMany).not.toHaveBeenCalled();
        expect(prisma.userMcpServer.findMany).not.toHaveBeenCalled();
    });

    test('lists org servers and merges only the caller token status', async () => {
        const prisma = createPrismaMock();
        mocks.authContext = {
            org: { id: 1 },
            user: { id: 'user-1' },
            prisma,
        };

        const response = await GET(createRequest());
        const body = await response.json();

        expect(prisma.mcpServer.findMany).toHaveBeenCalledWith({
            where: { orgId: 1 },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                sanitizedName: true,
                serverUrl: true,
            },
        });
        expect(prisma.userMcpServer.findMany).toHaveBeenCalledWith({
            where: { userId: 'user-1' },
            select: {
                serverId: true,
                tokens: true,
                tokensExpiresAt: true,
            },
        });
        expect(body).toMatchObject([
            {
                id: 'server-1',
                name: 'Linear',
                sanitizedName: 'linear',
                isConnected: true,
                isAuthExpired: false,
            },
            {
                id: 'server-2',
                name: 'Sentry',
                sanitizedName: 'sentry',
                isConnected: false,
                isAuthExpired: false,
            },
            {
                id: 'server-3',
                name: 'GitHub',
                sanitizedName: 'github',
                isConnected: false,
                isAuthExpired: true,
            },
        ]);
    });
});
