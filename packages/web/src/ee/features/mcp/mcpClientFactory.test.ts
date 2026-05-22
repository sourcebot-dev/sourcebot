import { expect, test, describe, vi } from 'vitest';
import { prisma } from '@/__mocks__/prisma';
import type { OAuthTokens } from '@ai-sdk/mcp';

// --- Mocks ---

vi.mock('@/prisma', async () => {
    const actual = await vi.importActual<typeof import('@/__mocks__/prisma')>('@/__mocks__/prisma');
    return { ...actual };
});

vi.mock('@sourcebot/shared', () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
    env: { AUTH_URL: 'http://localhost:3000' },
    decryptOAuthToken: vi.fn((s: string) => s),
}));

vi.mock('server-only', () => ({ default: vi.fn() }));

vi.mock('@/features/mcp/prismaOAuthClientProvider', () => ({
    PrismaOAuthClientProvider: vi.fn(),
}));

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
    StreamableHTTPClientTransport: vi.fn(),
}));

// Import after mocks are set up
const { isTokenExpiredWithNoRefresh, getConnectedMcpClients } = await import('./mcpClientFactory');

// --- Helpers ---

const PAST = new Date('2020-01-01');
const FUTURE = new Date('2099-01-01');

const TOKEN_NO_REFRESH: OAuthTokens = { access_token: 'tok', token_type: 'Bearer' };
const TOKEN_WITH_REFRESH: OAuthTokens = { access_token: 'tok', token_type: 'Bearer', refresh_token: 'ref' };

function makeUserServer(overrides: {
    tokens?: OAuthTokens;
    tokensExpiresAt?: Date | null;
    orgId?: number;
}) {
    return {
        serverId: 'srv-1',
        userId: 'user-1',
        name: 'MyServer',
        tokens: JSON.stringify(overrides.tokens ?? TOKEN_NO_REFRESH),
        tokensExpiresAt: overrides.tokensExpiresAt ?? null,
        server: {
            orgId: overrides.orgId ?? 1,
            serverUrl: 'https://example.com/mcp',
        },
    };
}

// --- isTokenExpiredWithNoRefresh ---

describe('isTokenExpiredWithNoRefresh', () => {
    test('returns true when access token is expired and no refresh token', () => {
        expect(isTokenExpiredWithNoRefresh(TOKEN_NO_REFRESH, PAST)).toBe(true);
    });

    test('returns false when refresh_token is present even if access token is expired', () => {
        expect(isTokenExpiredWithNoRefresh(TOKEN_WITH_REFRESH, PAST)).toBe(false);
    });

    test('returns false when tokensExpiresAt is null', () => {
        expect(isTokenExpiredWithNoRefresh(TOKEN_NO_REFRESH, null)).toBe(false);
    });

    test('returns false when access token has not yet expired', () => {
        expect(isTokenExpiredWithNoRefresh(TOKEN_NO_REFRESH, FUTURE)).toBe(false);
    });
});

// --- getConnectedMcpClients ---

describe('getConnectedMcpClients', () => {
    test('skips server when access token expired and no refresh token', async () => {
        prisma.userMcpServer.findMany.mockResolvedValue([
            makeUserServer({ tokens: TOKEN_NO_REFRESH, tokensExpiresAt: PAST }),
        ] as never);

        const result = await getConnectedMcpClients('user-1', 1);
        expect(result).toHaveLength(0);
    });

    test('includes server when refresh_token present even if access token expired', async () => {
        prisma.userMcpServer.findMany.mockResolvedValue([
            makeUserServer({ tokens: TOKEN_WITH_REFRESH, tokensExpiresAt: PAST }),
        ] as never);

        const result = await getConnectedMcpClients('user-1', 1);
        expect(result).toHaveLength(1);
    });

    test('includes server when tokensExpiresAt is null', async () => {
        prisma.userMcpServer.findMany.mockResolvedValue([
            makeUserServer({ tokensExpiresAt: null }),
        ] as never);

        const result = await getConnectedMcpClients('user-1', 1);
        expect(result).toHaveLength(1);
    });

    test('skips server belonging to a different org', async () => {
        prisma.userMcpServer.findMany.mockResolvedValue([
            makeUserServer({ orgId: 999 }),
        ] as never);

        const result = await getConnectedMcpClients('user-1', 1);
        expect(result).toHaveLength(0);
    });

    test('returns server metadata from the user MCP server row', async () => {
        prisma.userMcpServer.findMany.mockResolvedValue([
            makeUserServer({ tokens: TOKEN_WITH_REFRESH }),
        ] as never);

        const result = await getConnectedMcpClients('user-1', 1);
        expect(result[0]).toMatchObject({
            serverId: 'srv-1',
            serverName: 'MyServer',
            serverUrl: 'https://example.com/mcp',
        });
    });
});
