import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { OrgRole } from '@sourcebot/db';
import { ErrorCode } from '@/lib/errorCodes';

const mocks = vi.hoisted(() => ({
    authContext: undefined as unknown,
    hasEntitlement: vi.fn(),
    withAuth: vi.fn(),
    unsafePrisma: {
        userMcpServer: {
            groupBy: vi.fn(),
        },
    },
}));

vi.mock('@/lib/posthog', () => ({
    captureEvent: vi.fn(),
}));
vi.mock('@/lib/entitlements', () => ({
    hasEntitlement: mocks.hasEntitlement,
}));
vi.mock('@/middleware/withAuth', () => ({
    withAuth: mocks.withAuth,
}));
vi.mock('@/prisma', () => ({
    __unsafePrisma: mocks.unsafePrisma,
}));

const { GET } = await import('./route');

function createRequest() {
    return new NextRequest('http://localhost/api/ee/askmcp/configuration', { method: 'GET' });
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
            ]),
        },
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasEntitlement.mockResolvedValue(true);
    mocks.withAuth.mockImplementation((callback: (context: unknown) => unknown) => callback(mocks.authContext));
    mocks.unsafePrisma.userMcpServer.groupBy.mockResolvedValue([
        {
            serverId: 'server-1',
            _count: { _all: 2 },
        },
    ]);
});

describe('GET /api/ee/askmcp/configuration', () => {
    test('lists approved servers with current-member saved connection counts', async () => {
        const prisma = createPrismaMock();
        mocks.authContext = {
            org: { id: 1 },
            role: OrgRole.OWNER,
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
        expect(mocks.unsafePrisma.userMcpServer.groupBy).toHaveBeenCalledWith({
            by: ['serverId'],
            where: {
                serverId: { in: ['server-1', 'server-2'] },
                tokens: { not: null },
                server: { orgId: 1 },
                user: {
                    orgs: {
                        some: { orgId: 1 },
                    },
                },
            },
            _count: { _all: true },
        });
        expect(body).toMatchObject({
            totalSavedConnectionCount: 2,
            allowedMode: 'approved_only',
            isOAuthAvailable: true,
            servers: [
                {
                    id: 'server-1',
                    name: 'Linear',
                    savedConnectionCount: 2,
                },
                {
                    id: 'server-2',
                    name: 'Sentry',
                    savedConnectionCount: 0,
                },
            ],
        });
    });

    test('rejects non-owners before the unsafe aggregate query', async () => {
        const prisma = createPrismaMock();
        mocks.authContext = {
            org: { id: 1 },
            role: OrgRole.MEMBER,
            prisma,
        };

        const response = await GET(createRequest());
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toMatchObject({
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
        });
        expect(prisma.mcpServer.findMany).not.toHaveBeenCalled();
        expect(mocks.hasEntitlement).not.toHaveBeenCalled();
        expect(mocks.unsafePrisma.userMcpServer.groupBy).not.toHaveBeenCalled();
    });

    test('rejects unauthenticated callers before checking OAuth entitlement', async () => {
        mocks.withAuth.mockResolvedValue({
            statusCode: 401,
            errorCode: ErrorCode.NOT_AUTHENTICATED,
            message: 'Not authenticated',
        });

        const response = await GET(createRequest());
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body).toMatchObject({
            errorCode: ErrorCode.NOT_AUTHENTICATED,
        });
        expect(mocks.hasEntitlement).not.toHaveBeenCalled();
        expect(mocks.unsafePrisma.userMcpServer.groupBy).not.toHaveBeenCalled();
    });

    test('allows entitled owners to list cleanup data when OAuth is unsupported', async () => {
        const prisma = createPrismaMock();
        mocks.authContext = {
            org: { id: 1 },
            role: OrgRole.OWNER,
            prisma,
        };
        mocks.hasEntitlement.mockResolvedValue(false);

        const response = await GET(createRequest());
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toMatchObject({
            isOAuthAvailable: false,
            totalSavedConnectionCount: 2,
            servers: [
                {
                    id: 'server-1',
                    savedConnectionCount: 2,
                },
                {
                    id: 'server-2',
                    savedConnectionCount: 0,
                },
            ],
        });
        expect(mocks.withAuth).toHaveBeenCalled();
        expect(prisma.mcpServer.findMany).toHaveBeenCalled();
        expect(mocks.unsafePrisma.userMcpServer.groupBy).toHaveBeenCalled();
    });

    test('skips the unsafe aggregate query when there are no approved servers', async () => {
        const prisma = createPrismaMock();
        prisma.mcpServer.findMany.mockResolvedValue([]);
        mocks.authContext = {
            org: { id: 1 },
            role: OrgRole.OWNER,
            prisma,
        };

        const response = await GET(createRequest());
        const body = await response.json();

        expect(mocks.unsafePrisma.userMcpServer.groupBy).not.toHaveBeenCalled();
        expect(body).toEqual({
            servers: [],
            totalSavedConnectionCount: 0,
            allowedMode: 'approved_only',
            isOAuthAvailable: true,
        });
    });
});
