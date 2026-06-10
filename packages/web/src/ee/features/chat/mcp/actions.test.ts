import { beforeEach, describe, expect, test, vi } from 'vitest';
import { McpServerClientInfoSource, McpServerToolPermission, OrgRole } from '@sourcebot/db';
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
        $transaction: vi.fn(),
        mcpServer: {
            delete: vi.fn(),
            findFirst: vi.fn(),
            update: vi.fn(),
        },
        mcpServerOAuthScope: {
            createMany: vi.fn(),
            deleteMany: vi.fn(),
        },
        mcpServerTool: {
            upsert: vi.fn(),
        },
        userMcpServer: {
            deleteMany: vi.fn(),
            updateMany: vi.fn(),
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

const {
    createMcpServer,
    createStaticOAuthMcpServer,
    deleteMcpServer,
    disconnectMcpServer,
    updateMcpServerOAuthScopes,
    updateMcpServerToolPermissions,
} = await import('./actions');

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
    requestedOAuthScopes: string[];
    availableOAuthScopes: string[];
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
    mocks.unsafePrisma.$transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback(mocks.unsafePrisma));
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

    test('owners can add an org MCP server with requested scopes', async () => {
        const prisma = setAuthContext(OrgRole.OWNER);

        await expect(createMcpServer('GitHub', 'https://api.githubcopilot.com/mcp/', [
            ' repo ',
            'read:user',
            'repo',
        ], [
            'read:user',
            'repo',
            'admin:org',
        ])).resolves.toMatchObject({
            id: 'server-1',
            name: 'GitHub',
            sanitizedName: 'github',
        });

        expect(prisma.mcpServer.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                oauthScopes: {
                    createMany: {
                        data: [
                            { scope: 'admin:org', enabled: false },
                            { scope: 'read:user', enabled: true },
                            { scope: 'repo', enabled: true },
                        ],
                    },
                },
            }),
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

    test('owners cannot add org MCP servers when Ask Agent is unavailable', async () => {
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

    test('owners add a static OAuth MCP server with requested scopes', async () => {
        const prisma = setAuthContext(OrgRole.OWNER);

        await expect(createStaticOAuthMcpServer(createStaticOAuthRequest({
            requestedOAuthScopes: ['search:read.public', ' channels:history ', 'search:read.public'],
            availableOAuthScopes: ['channels:history', 'search:read.public', 'users:read'],
        }))).resolves.toMatchObject({
            id: 'server-1',
            name: 'Slack',
        });

        expect(prisma.mcpServer.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                oauthScopes: {
                    createMany: {
                        data: [
                            { scope: 'channels:history', enabled: true },
                            { scope: 'search:read.public', enabled: true },
                            { scope: 'users:read', enabled: false },
                        ],
                    },
                },
            }),
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

describe('updateMcpServerOAuthScopes', () => {
    test('owners update static connector scopes and invalidate saved user tokens', async () => {
        setAuthContext(OrgRole.OWNER);
        mocks.unsafePrisma.mcpServer.findFirst.mockResolvedValue({
            id: 'server-1',
            clientInfoSource: McpServerClientInfoSource.STATIC,
            oauthScopes: [
                { scope: 'search:read.public', enabled: true },
            ],
        });
        mocks.unsafePrisma.mcpServerOAuthScope.deleteMany.mockResolvedValue({ count: 1 });
        mocks.unsafePrisma.mcpServerOAuthScope.createMany.mockResolvedValue({ count: 3 });
        mocks.unsafePrisma.userMcpServer.updateMany.mockResolvedValue({ count: 2 });

        const result = await updateMcpServerOAuthScopes(' server-1 ', [
            { scope: ' chat:write ', enabled: true },
            { scope: 'files:read', enabled: true },
            { scope: 'users:read', enabled: false },
            { scope: 'chat:write', enabled: true },
        ]);

        expect(result).toEqual({
            success: true,
            oauthScopes: [
                { scope: 'chat:write', enabled: true },
                { scope: 'files:read', enabled: true },
                { scope: 'users:read', enabled: false },
            ],
            requestedOAuthScopes: ['chat:write', 'files:read'],
            invalidatedConnectionCount: 2,
        });
        expect(mocks.unsafePrisma.mcpServer.findFirst).toHaveBeenCalledWith({
            where: {
                id: 'server-1',
                orgId: 1,
            },
            select: {
                id: true,
                clientInfoSource: true,
                oauthScopes: {
                    select: {
                        scope: true,
                        enabled: true,
                    },
                },
            },
        });
        expect(mocks.unsafePrisma.mcpServerOAuthScope.deleteMany).toHaveBeenCalledWith({
            where: { mcpServerId: 'server-1' },
        });
        expect(mocks.unsafePrisma.mcpServerOAuthScope.createMany).toHaveBeenCalledWith({
            data: [
                { mcpServerId: 'server-1', scope: 'chat:write', enabled: true },
                { mcpServerId: 'server-1', scope: 'files:read', enabled: true },
                { mcpServerId: 'server-1', scope: 'users:read', enabled: false },
            ],
        });
        expect(mocks.unsafePrisma.mcpServer.update).not.toHaveBeenCalled();
        expect(mocks.unsafePrisma.userMcpServer.updateMany).toHaveBeenCalledWith({
            where: { serverId: 'server-1' },
            data: {
                tokens: null,
                tokensExpiresAt: null,
                codeVerifier: null,
                state: null,
            },
        });
    });

    test('clears dynamic client registration when dynamic connector scopes change', async () => {
        setAuthContext(OrgRole.OWNER);
        mocks.unsafePrisma.mcpServer.findFirst.mockResolvedValue({
            id: 'server-1',
            clientInfoSource: McpServerClientInfoSource.DYNAMIC,
            oauthScopes: [],
        });
        mocks.unsafePrisma.mcpServer.update.mockResolvedValue({ id: 'server-1' });
        mocks.unsafePrisma.mcpServerOAuthScope.deleteMany.mockResolvedValue({ count: 0 });
        mocks.unsafePrisma.mcpServerOAuthScope.createMany.mockResolvedValue({ count: 1 });
        mocks.unsafePrisma.userMcpServer.updateMany.mockResolvedValue({ count: 1 });

        await expect(updateMcpServerOAuthScopes('server-1', [
            { scope: 'repo', enabled: true },
        ])).resolves.toMatchObject({
            success: true,
            invalidatedConnectionCount: 1,
        });

        expect(mocks.unsafePrisma.mcpServer.update).toHaveBeenCalledWith({
            where: { id: 'server-1' },
            data: {
                clientInfo: null,
            },
        });
    });

    test('does not invalidate tokens when normalized scopes are unchanged', async () => {
        setAuthContext(OrgRole.OWNER);
        mocks.unsafePrisma.mcpServer.findFirst.mockResolvedValue({
            id: 'server-1',
            clientInfoSource: McpServerClientInfoSource.STATIC,
            oauthScopes: [
                { scope: 'chat:write', enabled: true },
                { scope: 'files:read', enabled: true },
            ],
        });

        const result = await updateMcpServerOAuthScopes('server-1', [
            { scope: 'files:read', enabled: true },
            { scope: 'chat:write', enabled: true },
            { scope: 'files:read', enabled: true },
        ]);

        expect(result).toEqual({
            success: true,
            oauthScopes: [
                { scope: 'chat:write', enabled: true },
                { scope: 'files:read', enabled: true },
            ],
            requestedOAuthScopes: ['chat:write', 'files:read'],
            invalidatedConnectionCount: 0,
        });
        expect(mocks.unsafePrisma.mcpServer.update).not.toHaveBeenCalled();
        expect(mocks.unsafePrisma.mcpServerOAuthScope.deleteMany).not.toHaveBeenCalled();
        expect(mocks.unsafePrisma.mcpServerOAuthScope.createMany).not.toHaveBeenCalled();
        expect(mocks.unsafePrisma.userMcpServer.updateMany).not.toHaveBeenCalled();
    });

    test('does not invalidate tokens when only disabled scope entries change', async () => {
        setAuthContext(OrgRole.OWNER);
        mocks.unsafePrisma.mcpServer.findFirst.mockResolvedValue({
            id: 'server-1',
            clientInfoSource: McpServerClientInfoSource.STATIC,
            oauthScopes: [
                { scope: 'chat:write', enabled: true },
            ],
        });
        mocks.unsafePrisma.mcpServerOAuthScope.deleteMany.mockResolvedValue({ count: 1 });
        mocks.unsafePrisma.mcpServerOAuthScope.createMany.mockResolvedValue({ count: 2 });

        const result = await updateMcpServerOAuthScopes('server-1', [
            { scope: 'chat:write', enabled: true },
            { scope: 'files:read', enabled: false },
        ]);

        expect(result).toEqual({
            success: true,
            oauthScopes: [
                { scope: 'chat:write', enabled: true },
                { scope: 'files:read', enabled: false },
            ],
            requestedOAuthScopes: ['chat:write'],
            invalidatedConnectionCount: 0,
        });
        expect(mocks.unsafePrisma.mcpServerOAuthScope.deleteMany).toHaveBeenCalledWith({
            where: { mcpServerId: 'server-1' },
        });
        expect(mocks.unsafePrisma.mcpServerOAuthScope.createMany).toHaveBeenCalledWith({
            data: [
                { mcpServerId: 'server-1', scope: 'chat:write', enabled: true },
                { mcpServerId: 'server-1', scope: 'files:read', enabled: false },
            ],
        });
        expect(mocks.unsafePrisma.userMcpServer.updateMany).not.toHaveBeenCalled();
    });

    test('rejects invalid OAuth scope tokens', async () => {
        setAuthContext(OrgRole.OWNER);

        const result = await updateMcpServerOAuthScopes('server-1', [
            { scope: 'bad scope', enabled: true },
        ]);

        expect(result).toMatchObject({
            statusCode: 400,
            errorCode: ErrorCode.INVALID_REQUEST_BODY,
        });
        expect(mocks.unsafePrisma.$transaction).not.toHaveBeenCalled();
    });

    test('returns not found when updating a missing connector', async () => {
        setAuthContext(OrgRole.OWNER);
        mocks.unsafePrisma.mcpServer.findFirst.mockResolvedValue(null);

        const result = await updateMcpServerOAuthScopes('server-1', [
            { scope: 'chat:write', enabled: true },
        ]);

        expect(result).toMatchObject({
            statusCode: 404,
            errorCode: ErrorCode.MCP_SERVER_NOT_FOUND,
        });
        expect(mocks.unsafePrisma.mcpServer.update).not.toHaveBeenCalled();
        expect(mocks.unsafePrisma.userMcpServer.updateMany).not.toHaveBeenCalled();
    });

    test('members cannot update connector scopes', async () => {
        setAuthContext(OrgRole.MEMBER);

        const result = await updateMcpServerOAuthScopes('server-1', [
            { scope: 'chat:write', enabled: true },
        ]);

        expect(result).toMatchObject({
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
        });
        expect(mocks.unsafePrisma.$transaction).not.toHaveBeenCalled();
    });

    test('owners cannot update connector scopes when Ask Agent is unavailable', async () => {
        setAuthContext(OrgRole.OWNER);
        mocks.hasEntitlement.mockResolvedValue(false);

        const result = await updateMcpServerOAuthScopes('server-1', [
            { scope: 'chat:write', enabled: true },
        ]);

        expect(result).toMatchObject({
            statusCode: 403,
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
        });
        expect(mocks.unsafePrisma.$transaction).not.toHaveBeenCalled();
    });
});

describe('updateMcpServerToolPermissions', () => {
    test('owners update connector tool permissions without invalidating tokens', async () => {
        setAuthContext(OrgRole.OWNER);
        mocks.unsafePrisma.mcpServer.findFirst.mockResolvedValue({ id: 'server-1' });
        mocks.unsafePrisma.mcpServerTool.upsert.mockResolvedValue({});

        const result = await updateMcpServerToolPermissions(' server-1 ', [
            { toolName: ' search ', permission: McpServerToolPermission.NEEDS_APPROVAL },
            { toolName: 'delete_issue', permission: McpServerToolPermission.DISABLED },
            { toolName: 'search', permission: McpServerToolPermission.ALLOWED },
        ]);

        expect(result).toEqual({
            success: true,
            updatedToolCount: 2,
        });
        expect(mocks.unsafePrisma.mcpServer.findFirst).toHaveBeenCalledWith({
            where: {
                id: 'server-1',
                orgId: 1,
            },
            select: { id: true },
        });
        expect(mocks.unsafePrisma.mcpServerTool.upsert).toHaveBeenCalledTimes(2);
        expect(mocks.unsafePrisma.mcpServerTool.upsert).toHaveBeenNthCalledWith(1, {
            where: {
                mcpServerId_toolName: {
                    mcpServerId: 'server-1',
                    toolName: 'delete_issue',
                },
            },
            create: {
                mcpServerId: 'server-1',
                toolName: 'delete_issue',
                permission: McpServerToolPermission.DISABLED,
            },
            update: {
                permission: McpServerToolPermission.DISABLED,
            },
        });
        expect(mocks.unsafePrisma.mcpServerTool.upsert).toHaveBeenNthCalledWith(2, {
            where: {
                mcpServerId_toolName: {
                    mcpServerId: 'server-1',
                    toolName: 'search',
                },
            },
            create: {
                mcpServerId: 'server-1',
                toolName: 'search',
                permission: McpServerToolPermission.ALLOWED,
            },
            update: {
                permission: McpServerToolPermission.ALLOWED,
            },
        });
        expect(mocks.unsafePrisma.userMcpServer.updateMany).not.toHaveBeenCalled();
    });

    test('returns not found when updating tool permissions for a missing connector', async () => {
        setAuthContext(OrgRole.OWNER);
        mocks.unsafePrisma.mcpServer.findFirst.mockResolvedValue(null);

        const result = await updateMcpServerToolPermissions('server-1', [
            { toolName: 'search', permission: McpServerToolPermission.ALLOWED },
        ]);

        expect(result).toMatchObject({
            statusCode: 404,
            errorCode: ErrorCode.MCP_SERVER_NOT_FOUND,
        });
        expect(mocks.unsafePrisma.mcpServerTool.upsert).not.toHaveBeenCalled();
    });

    test('members cannot update connector tool permissions', async () => {
        setAuthContext(OrgRole.MEMBER);

        const result = await updateMcpServerToolPermissions('server-1', [
            { toolName: 'search', permission: McpServerToolPermission.ALLOWED },
        ]);

        expect(result).toMatchObject({
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
        });
        expect(mocks.unsafePrisma.$transaction).not.toHaveBeenCalled();
    });

    test('rejects invalid tool permission payloads', async () => {
        setAuthContext(OrgRole.OWNER);

        const result = await updateMcpServerToolPermissions('server-1', [
            { toolName: '', permission: McpServerToolPermission.ALLOWED },
        ]);

        expect(result).toMatchObject({
            statusCode: 400,
            errorCode: ErrorCode.INVALID_REQUEST_BODY,
        });
        expect(mocks.unsafePrisma.$transaction).not.toHaveBeenCalled();
    });
});

describe('deleteMcpServer', () => {
    test('owners delete through the narrowly scoped unsafe client and track the removal', async () => {
        setAuthContext(OrgRole.OWNER);
        mocks.unsafePrisma.mcpServer.findFirst.mockResolvedValue({
            id: 'server-1',
            serverUrl: 'https://mcp.linear.app/mcp',
            clientInfoSource: McpServerClientInfoSource.DYNAMIC,
        });
        mocks.unsafePrisma.mcpServer.delete.mockResolvedValue({ id: 'server-1' });

        await expect(deleteMcpServer('server-1')).resolves.toEqual({ success: true });
        expect(mocks.unsafePrisma.mcpServer.findFirst).toHaveBeenCalledWith({
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
        expect(mocks.unsafePrisma.mcpServer.delete).toHaveBeenCalledWith({
            where: {
                id: 'server-1',
            },
        });
        expect(mocks.captureEvent).toHaveBeenCalledWith('ask_mcp_connector_removed', {
            source: 'sourcebot-web-client',
            entryPoint: 'workspace_settings',
            serverId: 'server-1',
            serverUrl: 'https://mcp.linear.app/mcp',
            authMode: 'dynamic',
        });
        expect(mocks.hasEntitlement).not.toHaveBeenCalled();
    });

    test('returns not found and tracks nothing when the connector does not exist', async () => {
        setAuthContext(OrgRole.OWNER);
        mocks.unsafePrisma.mcpServer.findFirst.mockResolvedValue(null);

        const result = await deleteMcpServer('server-1');

        expect(result).toMatchObject({
            errorCode: ErrorCode.MCP_SERVER_NOT_FOUND,
        });
        expect(mocks.unsafePrisma.mcpServer.delete).not.toHaveBeenCalled();
        expect(mocks.captureEvent).not.toHaveBeenCalled();
    });

    test('members cannot delete org MCP servers', async () => {
        setAuthContext(OrgRole.MEMBER);

        const result = await deleteMcpServer('server-1');

        expect(result).toMatchObject({
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
        });
        expect(mocks.unsafePrisma.mcpServer.findFirst).not.toHaveBeenCalled();
        expect(mocks.unsafePrisma.mcpServer.delete).not.toHaveBeenCalled();
    });

    test('owners can delete org MCP servers when Ask Agent is unavailable', async () => {
        setAuthContext(OrgRole.OWNER);
        mocks.hasEntitlement.mockResolvedValue(false);
        mocks.unsafePrisma.mcpServer.findFirst.mockResolvedValue({
            id: 'server-1',
            serverUrl: 'https://mcp.linear.app/mcp',
            clientInfoSource: McpServerClientInfoSource.DYNAMIC,
        });
        mocks.unsafePrisma.mcpServer.delete.mockResolvedValue({ id: 'server-1' });

        await expect(deleteMcpServer('server-1')).resolves.toEqual({ success: true });

        expect(mocks.hasEntitlement).not.toHaveBeenCalled();
        expect(mocks.unsafePrisma.mcpServer.delete).toHaveBeenCalledWith({
            where: {
                id: 'server-1',
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
