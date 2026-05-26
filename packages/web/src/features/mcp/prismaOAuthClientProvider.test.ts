import { describe, expect, test, vi, beforeEach } from 'vitest';
import { McpServerClientInfoSource } from '@sourcebot/db';

vi.mock('server-only', () => ({}));
vi.mock('@/prisma', () => ({
    __unsafePrisma: {
        mcpServer: {},
        userMcpServer: {},
    },
}));
vi.mock('@sourcebot/shared', () => ({
    encryptOAuthToken: vi.fn((text: string | null | undefined) => text ? `encrypted:${text}` : undefined),
    decryptOAuthToken: vi.fn((text: string | null | undefined) => text?.startsWith('encrypted:') ? text.slice('encrypted:'.length) : text),
}));

const {
    PrismaOAuthClientProvider,
    clearMcpServerClientCredentialsForObservedClient,
} = await import('./prismaOAuthClientProvider');

function createPrismaMock() {
    return {
        mcpServer: {
            findFirst: vi.fn(),
            updateMany: vi.fn(),
        },
        userMcpServer: {
            findUnique: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
        },
    };
}

function createProvider(prisma = createPrismaMock(), allowClientRegistration = false) {
    return new PrismaOAuthClientProvider({
        prisma: prisma as never,
        clientInvalidationPrisma: prisma as never,
        serverId: 'server-1',
        orgId: 1,
        userId: 'user-1',
        callbackUrl: 'https://sourcebot.example.com/api/ee/askmcp/callback',
        allowClientRegistration,
    });
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('PrismaOAuthClientProvider modes', () => {
    test('connect-mode provider exposes saveClientInformation', () => {
        const provider = createProvider(createPrismaMock(), true);

        expect('saveClientInformation' in provider).toBe(true);
        expect(provider.saveClientInformation).toEqual(expect.any(Function));
    });

    test('runtime and callback providers omit saveClientInformation', () => {
        const provider = createProvider();

        expect('saveClientInformation' in provider).toBe(false);
        expect(provider.saveClientInformation).toBeUndefined();
    });
});

describe('clearMcpServerClientCredentialsForObservedClient', () => {
    test('matching observed clientInfo clears org clientInfo and all server tokens', async () => {
        const prisma = createPrismaMock();
        prisma.mcpServer.updateMany.mockResolvedValue({ count: 1 });
        prisma.userMcpServer.updateMany.mockResolvedValue({ count: 2 });

        const didClear = await clearMcpServerClientCredentialsForObservedClient({
            prisma: prisma as never,
            serverId: 'server-1',
            orgId: 1,
            observedClientInfo: 'encrypted-client-info',
        });

        expect(didClear).toBe(true);
        expect(prisma.mcpServer.updateMany).toHaveBeenCalledWith({
            where: {
                id: 'server-1',
                orgId: 1,
                clientInfo: 'encrypted-client-info',
                clientInfoSource: McpServerClientInfoSource.DYNAMIC,
            },
            data: { clientInfo: null },
        });
        expect(prisma.userMcpServer.updateMany).toHaveBeenCalledWith({
            where: {
                serverId: 'server-1',
                server: { orgId: 1 },
            },
            data: {
                tokens: null,
                tokensExpiresAt: null,
            },
        });
    });

    test('stale observed clientInfo clears neither org clientInfo nor tokens', async () => {
        const prisma = createPrismaMock();
        prisma.mcpServer.updateMany.mockResolvedValue({ count: 0 });

        const didClear = await clearMcpServerClientCredentialsForObservedClient({
            prisma: prisma as never,
            serverId: 'server-1',
            orgId: 1,
            observedClientInfo: 'stale-client-info',
        });

        expect(didClear).toBe(false);
        expect(prisma.mcpServer.updateMany).toHaveBeenCalledOnce();
        expect(prisma.userMcpServer.updateMany).not.toHaveBeenCalled();
    });
});

describe('PrismaOAuthClientProvider static client information', () => {
    test('clientInformation returns static OAuth client credentials', async () => {
        const prisma = createPrismaMock();
        prisma.mcpServer.findFirst.mockResolvedValue({
            clientInfo: 'encrypted:{"client_id":"client-id","client_secret":"client-secret"}',
            clientInfoSource: McpServerClientInfoSource.STATIC,
        });
        const provider = createProvider(prisma);

        await expect(provider.clientInformation()).resolves.toEqual({
            client_id: 'client-id',
            client_secret: 'client-secret',
        });
    });

    test('invalidate all preserves static client information and clears only the current user tokens and verifier', async () => {
        const prisma = createPrismaMock();
        prisma.mcpServer.findFirst.mockResolvedValue({
            clientInfo: 'encrypted:{"client_id":"client-id","client_secret":"client-secret"}',
            clientInfoSource: McpServerClientInfoSource.STATIC,
        });
        prisma.mcpServer.updateMany.mockResolvedValue({ count: 0 });
        prisma.userMcpServer.update.mockResolvedValue({
            userId: 'user-1',
            serverId: 'server-1',
        });
        const provider = createProvider(prisma);

        await provider.clientInformation();
        await provider.invalidateCredentials('all');

        expect(prisma.mcpServer.updateMany).toHaveBeenCalledWith({
            where: {
                id: 'server-1',
                orgId: 1,
                clientInfo: 'encrypted:{"client_id":"client-id","client_secret":"client-secret"}',
                clientInfoSource: McpServerClientInfoSource.DYNAMIC,
            },
            data: { clientInfo: null },
        });
        expect(prisma.userMcpServer.updateMany).not.toHaveBeenCalled();
        expect(prisma.userMcpServer.update).toHaveBeenCalledWith({
            where: {
                userId_serverId: { userId: 'user-1', serverId: 'server-1' },
            },
            data: {
                tokens: null,
                tokensExpiresAt: null,
            },
        });
        expect(prisma.userMcpServer.update).toHaveBeenCalledWith({
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
