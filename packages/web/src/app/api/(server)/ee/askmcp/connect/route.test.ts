import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
    authContext: undefined as unknown,
    hasEntitlement: vi.fn(),
    mcpAuth: vi.fn(),
    unsafePrisma: {
        $transaction: vi.fn(),
    },
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/posthog', () => ({
    captureEvent: vi.fn(),
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
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
    encryptOAuthToken: vi.fn((text: string | null | undefined) => text ? `encrypted:${text}` : undefined),
    decryptOAuthToken: vi.fn((text: string | null | undefined) => text?.startsWith('encrypted:') ? text.slice('encrypted:'.length) : text),
}));
vi.mock('@ai-sdk/mcp', () => ({
    auth: mocks.mcpAuth,
}));

const { POST } = await import('./route');

function createRequest() {
    return new NextRequest('http://localhost/api/ee/askmcp/connect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ serverId: 'server-1' }),
    });
}

function createPrismaMock() {
    return {
        mcpServer: {
            findFirst: vi.fn().mockResolvedValue({
                id: 'server-1',
                serverUrl: 'https://mcp.linear.app/mcp',
            }),
        },
        userMcpServer: {
            upsert: vi.fn().mockResolvedValue({ userId: 'user-1', serverId: 'server-1' }),
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
});

describe('POST /api/ee/askmcp/connect', () => {
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
            expect(options.fetchFn).toEqual(expect.any(Function));

            await provider.saveClientInformation({ client_id: 'client-1' });
            provider.authorizationUrl = 'https://oauth.example.com/authorize';
            return 'REDIRECT';
        });

        const response = await POST(createRequest());
        const body = await response.json();

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
            data: { clientInfo: 'encrypted:{"client_id":"client-1"}' },
        });
        expect(body).toEqual({ authorizationUrl: 'https://oauth.example.com/authorize' });
    });
});
