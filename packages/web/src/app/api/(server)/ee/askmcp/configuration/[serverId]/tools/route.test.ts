import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { McpServerToolPermission, OrgRole } from '@sourcebot/db';

const mocks = vi.hoisted(() => ({
    authContext: undefined as unknown,
    hasEntitlement: vi.fn(),
    getMcpToolMetadataForServer: vi.fn(),
    unsafePrisma: {
        mcpServerTool: {
            findMany: vi.fn(),
        },
        userMcpServer: {
            count: vi.fn(),
        },
    },
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/entitlements', () => ({
    hasEntitlement: mocks.hasEntitlement,
}));
vi.mock('@/middleware/withAuth', () => ({
    withAuth: vi.fn((callback: (context: unknown) => unknown) => callback(mocks.authContext)),
}));
vi.mock('@/ee/features/chat/mcp/mcpToolMetadata', () => ({
    getMcpToolMetadataForServer: mocks.getMcpToolMetadataForServer,
}));
vi.mock('@/prisma', () => ({
    __unsafePrisma: mocks.unsafePrisma,
}));

const { GET } = await import('./route');

function createRequest() {
    return new NextRequest('https://sourcebot.example.com/api/ee/askmcp/configuration/server-1/tools', { method: 'GET' });
}

function createPrismaMock() {
    return {
        mcpServer: {
            findFirst: vi.fn().mockResolvedValue({
                id: 'server-1',
                name: 'Linear',
                serverUrl: 'https://linear.example.com/mcp',
            }),
        },
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasEntitlement.mockResolvedValue(true);
    mocks.getMcpToolMetadataForServer.mockResolvedValue({
        status: 'available',
        serverId: 'server-1',
        tools: [
            {
                name: 'search',
                title: 'Search',
                description: 'Find issues',
            },
            {
                name: 'new_tool',
                description: 'Newly discovered',
                annotations: { readOnlyHint: true },
            },
        ],
    });
    mocks.unsafePrisma.mcpServerTool.findMany.mockResolvedValue([
        {
            toolName: 'disabled_old',
            permission: McpServerToolPermission.DISABLED,
            callCount: 1,
        },
        {
            toolName: 'search',
            permission: McpServerToolPermission.ALLOWED,
            callCount: 4,
        },
    ]);
    mocks.unsafePrisma.userMcpServer.count.mockResolvedValue(2);
});

describe('GET /api/ee/askmcp/configuration/[serverId]/tools', () => {
    test('returns stored and live tool permission data for owners', async () => {
        const prisma = createPrismaMock();
        mocks.authContext = {
            org: { id: 1 },
            user: { id: 'user-1' },
            role: OrgRole.OWNER,
            prisma,
        };

        const response = await GET(createRequest(), { params: Promise.resolve({ serverId: 'server-1' }) });
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(prisma.mcpServer.findFirst).toHaveBeenCalledWith({
            where: {
                id: 'server-1',
                orgId: 1,
            },
            select: {
                id: true,
                name: true,
                serverUrl: true,
            },
        });
        expect(mocks.getMcpToolMetadataForServer).toHaveBeenCalledWith(prisma, 'user-1', 1, 'server-1');
        expect(body).toMatchObject({
            server: {
                id: 'server-1',
                name: 'Linear',
                serverUrl: 'https://linear.example.com/mcp',
                savedConnectionCount: 2,
            },
            metadataStatus: { status: 'available' },
            tools: [
                {
                    toolName: 'disabled_old',
                    name: 'disabled_old',
                    permission: McpServerToolPermission.DISABLED,
                    callCount: 1,
                    discovered: false,
                },
                {
                    toolName: 'new_tool',
                    name: 'new_tool',
                    description: 'Newly discovered',
                    permission: McpServerToolPermission.ALLOWED,
                    callCount: 0,
                    discovered: true,
                    annotations: { readOnlyHint: true },
                },
                {
                    toolName: 'search',
                    name: 'search',
                    title: 'Search',
                    description: 'Find issues',
                    permission: McpServerToolPermission.ALLOWED,
                    callCount: 4,
                    discovered: true,
                },
            ],
        });
    });

    test('returns not found for connectors outside the org', async () => {
        const prisma = createPrismaMock();
        prisma.mcpServer.findFirst.mockResolvedValue(null);
        mocks.authContext = {
            org: { id: 1 },
            user: { id: 'user-1' },
            role: OrgRole.OWNER,
            prisma,
        };

        const response = await GET(createRequest(), { params: Promise.resolve({ serverId: 'missing-server' }) });
        const body = await response.json();

        expect(response.status).toBe(404);
        expect(body).toMatchObject({
            errorCode: 'MCP_SERVER_NOT_FOUND',
        });
        expect(mocks.getMcpToolMetadataForServer).not.toHaveBeenCalled();
    });

    test('rejects non-owner admins', async () => {
        const prisma = createPrismaMock();
        mocks.authContext = {
            org: { id: 1 },
            user: { id: 'user-1' },
            role: OrgRole.MEMBER,
            prisma,
        };

        const response = await GET(createRequest(), { params: Promise.resolve({ serverId: 'server-1' }) });
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toMatchObject({
            errorCode: 'INSUFFICIENT_PERMISSIONS',
        });
        expect(prisma.mcpServer.findFirst).not.toHaveBeenCalled();
    });
});
