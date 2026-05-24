import { beforeEach, describe, expect, test, vi } from 'vitest';
import { OrgRole } from '@sourcebot/db';
import { ErrorCode } from '@/lib/errorCodes';

const mocks = vi.hoisted(() => ({
    authContext: undefined as unknown,
    unsafePrisma: {
        mcpServer: {
            deleteMany: vi.fn(),
        },
    },
}));

vi.mock('server-only', () => ({}));
vi.mock('@/middleware/withAuth', () => ({
    withAuth: vi.fn((callback: (context: unknown) => unknown) => callback(mocks.authContext)),
}));
vi.mock('@/prisma', () => ({
    __unsafePrisma: mocks.unsafePrisma,
}));

const { createMcpServer, deleteMcpServer } = await import('./actions');

function createPrismaMock() {
    return {
        mcpServer: {
            findUnique: vi.fn().mockResolvedValue(null),
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
                id: 'server-1',
                name: 'Linear',
                sanitizedName: 'linear',
                serverUrl: 'https://mcp.linear.app/mcp',
            }),
        },
    };
}

function setAuthContext(role: OrgRole, prisma = createPrismaMock()) {
    mocks.authContext = {
        org: { id: 1 },
        role,
        prisma,
    };
    return prisma;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('createMcpServer', () => {
    test('owners add an org MCP server without dynamic client information', async () => {
        const prisma = setAuthContext(OrgRole.OWNER);

        const result = await createMcpServer(' Linear ', ' https://mcp.linear.app/mcp ');

        expect(result).toEqual({
            id: 'server-1',
            name: 'Linear',
            sanitizedName: 'linear',
            serverUrl: 'https://mcp.linear.app/mcp',
        });
        expect(prisma.mcpServer.create).toHaveBeenCalledWith({
            data: {
                name: 'Linear',
                sanitizedName: 'linear',
                serverUrl: 'https://mcp.linear.app/mcp',
                clientInfo: null,
                orgId: 1,
            },
        });
    });

    test('members cannot add org MCP servers', async () => {
        const prisma = setAuthContext(OrgRole.MEMBER);

        const result = await createMcpServer('Linear', 'https://mcp.linear.app/mcp');

        expect(result).toMatchObject({
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
        });
        expect(prisma.mcpServer.create).not.toHaveBeenCalled();
    });
});

describe('deleteMcpServer', () => {
    test('owners delete through the narrowly scoped unsafe client', async () => {
        setAuthContext(OrgRole.OWNER);
        mocks.unsafePrisma.mcpServer.deleteMany.mockResolvedValue({ count: 1 });

        await expect(deleteMcpServer('server-1')).resolves.toEqual({ success: true });
        expect(mocks.unsafePrisma.mcpServer.deleteMany).toHaveBeenCalledWith({
            where: {
                id: 'server-1',
                orgId: 1,
            },
        });
    });

    test('members cannot delete org MCP servers', async () => {
        setAuthContext(OrgRole.MEMBER);

        const result = await deleteMcpServer('server-1');

        expect(result).toMatchObject({
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
        });
        expect(mocks.unsafePrisma.mcpServer.deleteMany).not.toHaveBeenCalled();
    });
});
