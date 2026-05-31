import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { McpServerClientInfoSource } from '@sourcebot/db';
import { ErrorCode } from '@/lib/errorCodes';

const mocks = vi.hoisted(() => ({
    authContext: undefined as unknown,
    hasEntitlement: vi.fn(),
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
    mcpAuth: vi.fn(),
    unsafePrisma: {
        $transaction: vi.fn(),
    },
    captureEvent: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/posthog', () => ({
    captureEvent: mocks.captureEvent,
}));
vi.mock('@/lib/entitlements', () => ({
    hasEntitlement: mocks.hasEntitlement,
}));
vi.mock('@/middleware/withAuth', () => ({
    withAuth: vi.fn((callback: (context: unknown) => unknown) => callback(mocks.authContext)),
}));
vi.mock('@/prisma', () => ({
    __unsafePrisma: mocks.unsafePrisma,
}));
vi.mock('@sourcebot/shared', () => ({
    env: {
        AUTH_URL: 'https://sourcebot.example.com',
        SOURCEBOT_MCP_TOOL_CALL_TIMEOUT_MS: 5000,
    },
    createLogger: () => mocks.logger,
    encryptOAuthToken: vi.fn((text: string | null | undefined) => text ? `encrypted:${text}` : undefined),
    decryptOAuthToken: vi.fn((text: string | null | undefined) => text?.startsWith('encrypted:') ? text.slice('encrypted:'.length) : text),
}));
vi.mock('@ai-sdk/mcp', () => ({
    auth: mocks.mcpAuth,
}));

const { POST } = await import('./route');
const { getMcpOAuthReturnToFromState } = await import('@/ee/features/chat/mcp/mcpOAuthReturnTo');

function createRequest(body: { serverId: string; returnTo?: string } = { serverId: 'server-1' }) {
    return new NextRequest('https://sourcebot.example.com/api/ee/askmcp/connect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

function createMalformedJsonRequest() {
    return new NextRequest('https://sourcebot.example.com/api/ee/askmcp/connect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"serverId":',
    });
}

function createTextPlainRequest() {
    return new NextRequest('https://sourcebot.example.com/api/ee/askmcp/connect', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'server-1',
    });
}

function createEmptyBodyRequest() {
    return new NextRequest('https://sourcebot.example.com/api/ee/askmcp/connect', {
        method: 'POST',
    });
}

function createPrismaMock() {
    return {
        mcpServer: {
            findFirst: vi.fn().mockResolvedValue({
                id: 'server-1',
                name: 'Linear',
                sanitizedName: 'linear',
                serverUrl: 'https://mcp.linear.app/mcp',
                clientInfoSource: McpServerClientInfoSource.DYNAMIC,
                requestedScopes: ['repo'],
            }),
        },
        userMcpServer: {
            upsert: vi.fn().mockResolvedValue({ userId: 'user-1', serverId: 'server-1' }),
            deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
    };
}

function createTransactionMock() {
    return {
        $queryRaw: vi.fn().mockResolvedValue([{ id: 'server-1' }]),
        mcpServer: {
            findFirst: vi.fn(),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        userMcpServer: {
            findUnique: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
        },
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasEntitlement.mockResolvedValue(true);
    mocks.captureEvent.mockResolvedValue(undefined);
});

describe('POST /api/ee/askmcp/connect', () => {
    test.each([
        ['malformed JSON', createMalformedJsonRequest],
        ['text/plain body', createTextPlainRequest],
        ['empty body', createEmptyBodyRequest],
    ])('returns a request body validation error for %s', async (_name, createInvalidRequest) => {
        const response = await POST(createInvalidRequest());
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toMatchObject({
            statusCode: 400,
            errorCode: ErrorCode.INVALID_REQUEST_BODY,
            message: 'Invalid JSON request body.',
        });
        expect(mocks.mcpAuth).not.toHaveBeenCalled();
    });

    test('upserts a nameless user row and performs DCR-capable auth under a row lock', async () => {
        const prisma = createPrismaMock();
        const tx = createTransactionMock();
        mocks.authContext = {
            org: { id: 1 },
            user: { id: 'user-1' },
            prisma,
        };
        mocks.unsafePrisma.$transaction.mockImplementation(async (callback, _options) => callback(tx));
        mocks.mcpAuth.mockImplementation(async (provider, options) => {
            expect('saveClientInformation' in provider).toBe(true);
            expect(provider.saveClientInformation).toEqual(expect.any(Function));
            expect(provider.clientMetadata.scope).toBe('repo');
            expect(options.fetchFn).toEqual(expect.any(Function));

            await provider.saveClientInformation({ client_id: 'client-1' });
            provider.authorizationUrl = 'https://oauth.example.com/authorize';
            return 'REDIRECT';
        });

        const response = await POST(createRequest());
        const body = await response.json();

        expect(mocks.captureEvent).toHaveBeenCalledWith('ask_mcp_connector_connection_started', {
            source: 'sourcebot-web-client',
            entryPoint: 'unknown',
            serverId: 'server-1',
            serverUrl: 'https://mcp.linear.app/mcp',
            authMode: 'dynamic',
        });
        expect(prisma.userMcpServer.upsert).toHaveBeenCalledWith({
            where: {
                userId_serverId: {
                    userId: 'user-1',
                    serverId: 'server-1',
                },
            },
            create: {
                userId: 'user-1',
                serverId: 'server-1',
            },
            update: {},
        });
        expect(mocks.unsafePrisma.$transaction).toHaveBeenCalledWith(
            expect.any(Function),
            {
                maxWait: 10000,
                timeout: 10000,
            },
        );
        expect(tx.$queryRaw).toHaveBeenCalledOnce();
        expect(tx.mcpServer.updateMany).toHaveBeenCalledWith({
            where: { id: 'server-1', orgId: 1 },
            data: {
                clientInfo: 'encrypted:{"client_id":"client-1"}',
                clientInfoSource: McpServerClientInfoSource.DYNAMIC,
            },
        });
        expect(body).toEqual({ authorizationUrl: 'https://oauth.example.com/authorize' });
    });

    test('encodes a safe return path into OAuth state', async () => {
        const prisma = createPrismaMock();
        const tx = createTransactionMock();
        mocks.authContext = {
            org: { id: 1 },
            user: { id: 'user-1' },
            prisma,
        };
        mocks.unsafePrisma.$transaction.mockImplementation(async (callback, _options) => callback(tx));
        mocks.mcpAuth.mockImplementation(async (provider) => {
            const state = await provider.state();
            expect(getMcpOAuthReturnToFromState(state)).toBe('/chat');
            await provider.saveState(state);

            provider.authorizationUrl = 'https://oauth.example.com/authorize';
            return 'REDIRECT';
        });

        const response = await POST(createRequest({ serverId: 'server-1', returnTo: '/chat' }));
        const body = await response.json();

        expect(body).toEqual({ authorizationUrl: 'https://oauth.example.com/authorize' });
        expect(tx.userMcpServer.update).toHaveBeenCalledWith({
            where: {
                userId_serverId: { userId: 'user-1', serverId: 'server-1' },
            },
            data: {
                state: expect.stringContaining('sourcebot_mcp.'),
            },
        });
    });

    test('ignores unsafe return paths', async () => {
        const prisma = createPrismaMock();
        const tx = createTransactionMock();
        mocks.authContext = {
            org: { id: 1 },
            user: { id: 'user-1' },
            prisma,
        };
        mocks.unsafePrisma.$transaction.mockImplementation(async (callback, _options) => callback(tx));
        mocks.mcpAuth.mockImplementation(async (provider) => {
            const state = await provider.state();
            expect(getMcpOAuthReturnToFromState(state)).toBeUndefined();
            await provider.saveState(state);

            provider.authorizationUrl = 'https://oauth.example.com/authorize';
            return 'REDIRECT';
        });

        const response = await POST(createRequest({ serverId: 'server-1', returnTo: 'https://evil.example.com/chat' }));
        const body = await response.json();

        expect(body).toEqual({ authorizationUrl: 'https://oauth.example.com/authorize' });
        expect(tx.userMcpServer.update).toHaveBeenCalledWith({
            where: {
                userId_serverId: { userId: 'user-1', serverId: 'server-1' },
            },
            data: {
                state: expect.not.stringContaining('sourcebot_mcp.'),
            },
        });
    });

    test('sanitizes external OAuth errors before logging', async () => {
        const prisma = createPrismaMock();
        const tx = createTransactionMock();
        mocks.authContext = {
            org: { id: 1 },
            user: { id: 'user-1' },
            prisma,
        };
        mocks.unsafePrisma.$transaction.mockImplementation(async (callback, _options) => callback(tx));
        mocks.mcpAuth.mockImplementation(async () => {
            const error = new Error('invalid_client client_secret=client-secret refresh_token=refresh-token');
            Object.assign(error, {
                response: {
                    status: 400,
                    body: 'client_secret=client-secret refresh_token=refresh-token',
                },
            });
            throw error;
        });

        const response = await POST(createRequest());
        const body = await response.json();

        expect(response.status).toBe(502);
        expect(body).toMatchObject({
            message: 'Could not start connector authorization.',
        });
        expect(mocks.logger.warn).toHaveBeenCalledWith('Failed to start connector authorization.', {
            serverId: 'server-1',
            orgId: 1,
            error: {
                errorClass: 'Error',
                oauthError: 'invalid_client',
                statusCode: 400,
            },
        });
        expect(JSON.stringify(mocks.logger.warn.mock.calls)).not.toContain('client-secret');
        expect(JSON.stringify(mocks.logger.warn.mock.calls)).not.toContain('refresh-token');
        expect(JSON.stringify(mocks.logger.error.mock.calls)).not.toContain('client-secret');
        expect(JSON.stringify(mocks.logger.error.mock.calls)).not.toContain('refresh-token');
        expect(mocks.captureEvent).toHaveBeenCalledWith('ask_mcp_connector_connection_failed', {
            source: 'sourcebot-web-client',
            entryPoint: 'unknown',
            serverId: 'server-1',
            serverUrl: 'https://mcp.linear.app/mcp',
            authMode: 'dynamic',
            failureReason: 'invalid_client',
        });
        expect(prisma.userMcpServer.deleteMany).toHaveBeenCalledWith({
            where: {
                userId: 'user-1',
                serverId: 'server-1',
                tokens: null,
                tokensExpiresAt: null,
                codeVerifier: null,
                state: null,
            },
        });
    });
});
