import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    hasEntitlement: vi.fn(),
    mcpAuth: vi.fn(),
    unsafePrisma: {
        mcpServer: {
            updateMany: vi.fn(),
        },
        userMcpServer: {
            findFirst: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
        },
        userToOrg: {
            findUnique: vi.fn(),
        },
    },
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/posthog', () => ({
    captureEvent: vi.fn(),
}));
vi.mock('@/auth', () => ({
    auth: mocks.auth,
}));
vi.mock('@/lib/entitlements', () => ({
    hasEntitlement: mocks.hasEntitlement,
}));
vi.mock('@/prisma', () => ({
    prisma: mocks.unsafePrisma,
    __unsafePrisma: mocks.unsafePrisma,
}));
vi.mock('@sourcebot/shared', () => ({
    env: {
        AUTH_URL: 'https://sourcebot.example.com',
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

const { GET } = await import('./route');

function createRequest() {
    return new NextRequest('https://sourcebot.example.com/api/ee/askmcp/callback?code=code-1&state=state-1', {
        method: 'GET',
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.hasEntitlement.mockResolvedValue(true);
    mocks.unsafePrisma.userMcpServer.findFirst.mockResolvedValue({
        serverId: 'server-1',
        server: {
            orgId: 1,
            name: 'Linear',
            serverUrl: 'https://mcp.linear.app/mcp',
        },
    });
    mocks.unsafePrisma.userMcpServer.update.mockResolvedValue({ userId: 'user-1', serverId: 'server-1' });
    mocks.unsafePrisma.userToOrg.findUnique.mockResolvedValue({ orgId: 1, userId: 'user-1' });
});

describe('GET /api/ee/askmcp/callback', () => {
    test('redirects with a friendly reconnect error when callback auth cannot complete', async () => {
        mocks.mcpAuth.mockImplementation(async (provider) => {
            expect('saveClientInformation' in provider).toBe(false);
            await provider.invalidateCredentials('all');
            throw new Error('invalid_client');
        });

        const response = await GET(createRequest());
        const location = response.headers.get('location');

        expect(location).toBeTruthy();
        expect(location).toContain('/settings/mcpServers');
        expect(location).toContain('status=error');
        expect(new URL(location ?? '').searchParams.get('message')).toContain('Please reconnect the server');
        expect(mocks.unsafePrisma.userMcpServer.findFirst).toHaveBeenCalledWith({
            where: {
                state: 'state-1',
                userId: 'user-1',
            },
            select: {
                serverId: true,
                server: {
                    select: {
                        orgId: true,
                        name: true,
                        serverUrl: true,
                    },
                },
            },
        });
        expect(mocks.unsafePrisma.userMcpServer.update).toHaveBeenCalledWith({
            where: {
                userId_serverId: { userId: 'user-1', serverId: 'server-1' },
            },
            data: {
                codeVerifier: null,
                state: null,
            },
        });
    });
});
