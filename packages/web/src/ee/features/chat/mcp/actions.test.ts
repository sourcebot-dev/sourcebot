import { beforeEach, describe, expect, test, vi } from 'vitest';
import { McpServerClientInfoSource, OrgRole } from '@sourcebot/db';
import { ErrorCode } from '@/lib/errorCodes';

const mocks = vi.hoisted(() => ({
    authContext: undefined as unknown,
    hasEntitlement: vi.fn(),
    encryptOAuthToken: vi.fn((text: string | null | undefined) => text ? `encrypted:${text}` : undefined),
    env: {
        AUTH_URL: 'https://sourcebot.example.com',
        NODE_ENV: 'production',
        SOURCEBOT_MCP_TOOL_CALL_TIMEOUT_MS: 5000,
    },
    logger: {
        error: vi.fn(),
    },
    captureEvent: vi.fn(),
    unsafePrisma: {
        mcpServer: {
            deleteMany: vi.fn(),
            findFirst: vi.fn(),
        },
        userMcpServer: {
            deleteMany: vi.fn(),
        },
    },
}));

vi.mock('server-only', () => ({}));
vi.mock('@/middleware/withAuth', () => ({
    withAuth: vi.fn((callback: (context: unknown) => unknown) => callback(mocks.authContext)),
}));
vi.mock('@/lib/entitlements', () => ({
    hasEntitlement: mocks.hasEntitlement,
}));
vi.mock('@/prisma', () => ({
    __unsafePrisma: mocks.unsafePrisma,
}));
vi.mock('@sourcebot/shared', () => ({
    createLogger: () => mocks.logger,
    encryptOAuthToken: mocks.encryptOAuthToken,
    env: mocks.env,
}));
vi.mock('@/lib/posthog', () => ({
    captureEvent: mocks.captureEvent,
}));

const { createMcpServer, createStaticOAuthMcpServer, deleteMcpServer, disconnectMcpServer } = await import('./actions');

function createPrismaMock() {
    return {
        mcpServer: {
            findUnique: vi.fn().mockResolvedValue(null),
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockImplementation(async ({ data }) => ({
                id: 'server-1',
                name: data.name,
                sanitizedName: data.sanitizedName,
                serverUrl: data.serverUrl,
            })),
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

function createStaticOAuthRequest(overrides: Partial<{
    name: string;
    serverUrl: string;
    clientId: string;
    clientSecret: string;
}> = {}) {
    return {
        name: 'Slack',
        serverUrl: 'https://mcp.slack.com/mcp',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasEntitlement.mockResolvedValue(true);
    mocks.encryptOAuthToken.mockImplementation((text: string | null | undefined) => text ? `encrypted:${text}` : undefined);
    mocks.env.AUTH_URL = 'https://sourcebot.example.com';
    mocks.env.NODE_ENV = 'production';
    mocks.env.SOURCEBOT_MCP_TOOL_CALL_TIMEOUT_MS = 5000;
    mocks.captureEvent.mockResolvedValue(undefined);
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
                clientInfoSource: McpServerClientInfoSource.DYNAMIC,
                orgId: 1,
            },
        });
        expect(mocks.captureEvent).toHaveBeenCalledWith('ask_mcp_connector_added', {
            source: 'sourcebot-web-client',
            entryPoint: 'workspace_settings',
            serverId: 'server-1',
            serverUrl: 'https://mcp.linear.app/mcp',
            authMode: 'dynamic',
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

    test('owners cannot add org MCP servers when OAuth is unsupported', async () => {
        const prisma = setAuthContext(OrgRole.OWNER);
        mocks.hasEntitlement.mockResolvedValue(false);

        const result = await createMcpServer('Linear', 'https://mcp.linear.app/mcp');

        expect(result).toMatchObject({
            statusCode: 403,
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
        });
        expect(prisma.mcpServer.create).not.toHaveBeenCalled();
    });
});

describe('createStaticOAuthMcpServer', () => {
    test('owners add a static OAuth MCP server with encrypted client information', async () => {
        const prisma = setAuthContext(OrgRole.OWNER);

        const result = await createStaticOAuthMcpServer({
            name: ' Slack ',
            serverUrl: 'https://mcp.slack.com/mcp',
            clientId: ' client-id ',
            clientSecret: ' client-secret ',
        });

        expect(mocks.encryptOAuthToken).toHaveBeenCalledWith(JSON.stringify({
            client_id: 'client-id',
            client_secret: 'client-secret',
        }));
        expect(prisma.mcpServer.create).toHaveBeenCalledWith({
            data: {
                name: 'Slack',
                sanitizedName: 'slack',
                serverUrl: 'https://mcp.slack.com/mcp',
                clientInfo: 'encrypted:{"client_id":"client-id","client_secret":"client-secret"}',
                clientInfoSource: McpServerClientInfoSource.STATIC,
                orgId: 1,
            },
        });
        expect(JSON.stringify(result)).not.toContain('client-secret');
        expect(result).toEqual({
            id: 'server-1',
            name: 'Slack',
            sanitizedName: 'slack',
            serverUrl: 'https://mcp.slack.com/mcp',
        });
        expect(mocks.captureEvent).toHaveBeenCalledWith('ask_mcp_connector_added', {
            source: 'sourcebot-web-client',
            entryPoint: 'workspace_settings',
            serverId: 'server-1',
            serverUrl: 'https://mcp.slack.com/mcp',
            authMode: 'static',
        });
    });

    test('members cannot add static OAuth MCP servers', async () => {
        const prisma = setAuthContext(OrgRole.MEMBER);

        const result = await createStaticOAuthMcpServer(createStaticOAuthRequest());

        expect(result).toMatchObject({
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
        });
        expect(prisma.mcpServer.create).not.toHaveBeenCalled();
    });

    test('rejects static OAuth credentials when production AUTH_URL is not HTTPS', async () => {
        const prisma = setAuthContext(OrgRole.OWNER);
        mocks.env.AUTH_URL = 'http://sourcebot.example.com';

        const result = await createStaticOAuthMcpServer(createStaticOAuthRequest());

        expect(result).toMatchObject({
            statusCode: 400,
            errorCode: ErrorCode.INVALID_REQUEST_BODY,
            message: 'Static OAuth client credentials require HTTPS in production.',
        });
        expect(prisma.mcpServer.create).not.toHaveBeenCalled();
        expect(JSON.stringify(result)).not.toContain('client-secret');
    });

    test('does not echo client secrets in validation errors', async () => {
        const prisma = setAuthContext(OrgRole.OWNER);

        const result = await createStaticOAuthMcpServer({
            name: 'Slack',
            serverUrl: 'not-a-url',
            clientId: 'client-id',
            clientSecret: 'client-secret',
        });

        expect(result).toMatchObject({
            statusCode: 400,
            errorCode: ErrorCode.INVALID_REQUEST_BODY,
        });
        expect(JSON.stringify(result)).not.toContain('client-secret');
        expect(prisma.mcpServer.create).not.toHaveBeenCalled();
    });

    test('rejects static OAuth servers with non-HTTPS server URLs', async () => {
        const prisma = setAuthContext(OrgRole.OWNER);

        const result = await createStaticOAuthMcpServer(createStaticOAuthRequest({
            serverUrl: 'http://mcp.slack.com/mcp',
        }));

        expect(result).toMatchObject({
            statusCode: 400,
            errorCode: ErrorCode.INVALID_REQUEST_BODY,
            message: 'Invalid connector URL. Must be a valid HTTPS URL.',
        });
        expect(prisma.mcpServer.findUnique).not.toHaveBeenCalled();
        expect(prisma.mcpServer.create).not.toHaveBeenCalled();
        expect(mocks.encryptOAuthToken).not.toHaveBeenCalled();
        expect(JSON.stringify(result)).not.toContain('client-secret');
    });

    test('rejects static OAuth servers with fewer than 3 alphanumeric name characters', async () => {
        const prisma = setAuthContext(OrgRole.OWNER);

        const result = await createStaticOAuthMcpServer(createStaticOAuthRequest({
            name: '!!a!',
        }));

        expect(result).toMatchObject({
            statusCode: 400,
            errorCode: ErrorCode.INVALID_REQUEST_BODY,
            message: 'Connector name must contain at least 3 alphanumeric characters.',
        });
        expect(prisma.mcpServer.findUnique).not.toHaveBeenCalled();
        expect(prisma.mcpServer.create).not.toHaveBeenCalled();
        expect(mocks.encryptOAuthToken).not.toHaveBeenCalled();
        expect(JSON.stringify(result)).not.toContain('client-secret');
    });

    test('rejects static OAuth servers with a duplicate URL', async () => {
        const prisma = setAuthContext(OrgRole.OWNER);
        prisma.mcpServer.findUnique.mockResolvedValue({ id: 'existing-server' });

        const result = await createStaticOAuthMcpServer(createStaticOAuthRequest());

        expect(result).toMatchObject({
            statusCode: 409,
            errorCode: ErrorCode.MCP_SERVER_ALREADY_EXISTS,
            message: 'A connector with URL "https://mcp.slack.com/mcp" already exists.',
        });
        expect(prisma.mcpServer.findFirst).not.toHaveBeenCalled();
        expect(prisma.mcpServer.create).not.toHaveBeenCalled();
        expect(mocks.encryptOAuthToken).not.toHaveBeenCalled();
        expect(JSON.stringify(result)).not.toContain('client-secret');
    });

    test('rejects static OAuth servers with a duplicate sanitized name', async () => {
        const prisma = setAuthContext(OrgRole.OWNER);
        prisma.mcpServer.findFirst.mockResolvedValue({ id: 'existing-server' });

        const result = await createStaticOAuthMcpServer(createStaticOAuthRequest({
            name: 'Slack!!!',
        }));

        expect(result).toMatchObject({
            statusCode: 409,
            errorCode: ErrorCode.MCP_SERVER_ALREADY_EXISTS,
            message: 'A connector with a similar name already exists. Please choose a more distinct name.',
        });
        expect(prisma.mcpServer.findUnique).toHaveBeenCalledWith({
            where: {
                serverUrl_orgId: {
                    serverUrl: 'https://mcp.slack.com/mcp',
                    orgId: 1,
                },
            },
            select: { id: true },
        });
        expect(prisma.mcpServer.create).not.toHaveBeenCalled();
        expect(mocks.encryptOAuthToken).not.toHaveBeenCalled();
        expect(JSON.stringify(result)).not.toContain('client-secret');
    });

    test('rejects static OAuth servers when client credential encryption fails', async () => {
        const prisma = setAuthContext(OrgRole.OWNER);
        mocks.encryptOAuthToken.mockReturnValue(undefined);

        const result = await createStaticOAuthMcpServer(createStaticOAuthRequest());

        expect(result).toMatchObject({
            statusCode: 500,
            errorCode: ErrorCode.UNEXPECTED_ERROR,
            message: 'Failed to store OAuth client credentials.',
        });
        expect(prisma.mcpServer.create).not.toHaveBeenCalled();
        expect(JSON.stringify(result)).not.toContain('client-secret');
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
        expect(mocks.hasEntitlement).not.toHaveBeenCalled();
    });

    test('members cannot delete org MCP servers', async () => {
        setAuthContext(OrgRole.MEMBER);

        const result = await deleteMcpServer('server-1');

        expect(result).toMatchObject({
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
        });
        expect(mocks.unsafePrisma.mcpServer.deleteMany).not.toHaveBeenCalled();
    });

    test('owners can delete org MCP servers when OAuth is unsupported', async () => {
        setAuthContext(OrgRole.OWNER);
        mocks.hasEntitlement.mockResolvedValue(false);
        mocks.unsafePrisma.mcpServer.deleteMany.mockResolvedValue({ count: 1 });

        await expect(deleteMcpServer('server-1')).resolves.toEqual({ success: true });

        expect(mocks.hasEntitlement).not.toHaveBeenCalled();
        expect(mocks.unsafePrisma.mcpServer.deleteMany).toHaveBeenCalledWith({
            where: {
                id: 'server-1',
                orgId: 1,
            },
        });
    });
});

describe('disconnectMcpServer', () => {
    test('disconnects a personal connector and tracks the disconnect', async () => {
        const prisma = {
            mcpServer: {
                findFirst: vi.fn().mockResolvedValue({
                    id: 'server-1',
                    name: 'Linear',
                    serverUrl: 'https://mcp.linear.app/mcp',
                    sanitizedName: 'linear',
                    clientInfoSource: McpServerClientInfoSource.DYNAMIC,
                }),
            },
            userMcpServer: {
                deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
        };
        mocks.authContext = {
            org: { id: 1 },
            user: { id: 'user-1' },
            prisma,
        };

        await expect(disconnectMcpServer('server-1', 'account_settings')).resolves.toEqual({ success: true });

        expect(prisma.mcpServer.findFirst).toHaveBeenCalledWith({
            where: {
                id: 'server-1',
                orgId: 1,
            },
            select: {
                id: true,
                serverUrl: true,
                clientInfoSource: true,
            },
        });
        expect(prisma.userMcpServer.deleteMany).toHaveBeenCalledWith({
            where: {
                serverId: 'server-1',
                userId: 'user-1',
            },
        });
        expect(mocks.unsafePrisma.mcpServer.findFirst).not.toHaveBeenCalled();
        expect(mocks.unsafePrisma.userMcpServer.deleteMany).not.toHaveBeenCalled();
        expect(mocks.captureEvent).toHaveBeenCalledWith('ask_mcp_connector_disconnected', {
            source: 'sourcebot-web-client',
            entryPoint: 'account_settings',
            serverId: 'server-1',
            serverUrl: 'https://mcp.linear.app/mcp',
            authMode: 'dynamic',
        });
    });
});
