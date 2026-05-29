import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { PrismaClient } from '@sourcebot/db';

const createMCPClient = vi.hoisted(() => vi.fn());
const getConnectedMcpClients = vi.hoisted(() => vi.fn());
const loggerWarn = vi.hoisted(() => vi.fn());

vi.mock('@ai-sdk/mcp', () => ({
    createMCPClient,
}));

vi.mock('@sourcebot/shared', () => ({
    createLogger: () => ({
        warn: loggerWarn,
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    }),
    env: {
        SOURCEBOT_MCP_TOOL_CALL_TIMEOUT_MS: 60000,
    },
}));

vi.mock('./mcpClientFactory', () => ({
    getConnectedMcpClients,
}));

const { getMcpToolMetadata } = await import('./mcpToolMetadata');

function makeConnectedClient(serverId = 'server-1') {
    return {
        serverId,
        serverName: 'Linear',
        sanitizedName: 'linear',
        serverUrl: 'https://linear.example/mcp',
        transport: {
            close: vi.fn().mockResolvedValue(undefined),
        },
    };
}

beforeEach(() => {
    createMCPClient.mockReset();
    getConnectedMcpClients.mockReset();
    loggerWarn.mockReset();
});

describe('getMcpToolMetadata', () => {
    test('returns sanitized tool summaries for connected servers', async () => {
        const connectedClient = makeConnectedClient();
        const mcpClient = {
            listTools: vi.fn().mockResolvedValue({
                tools: [
                    {
                        name: '<b>lookup</b>',
                        title: '<i>Lookup</i>',
                        description: 'Find <script>alert(1)</script> issues\nquickly',
                        annotations: {
                            readOnlyHint: true,
                            destructiveHint: false,
                            idempotentHint: true,
                            unknownHint: true,
                        },
                        inputSchema: { type: 'object' },
                    },
                ],
            }),
            close: vi.fn().mockResolvedValue(undefined),
        };
        getConnectedMcpClients.mockResolvedValue([connectedClient]);
        createMCPClient.mockResolvedValue(mcpClient);

        const result = await getMcpToolMetadata({} as PrismaClient, 'user-1', 1);

        expect(result).toEqual([
            {
                status: 'available',
                serverId: 'server-1',
                tools: [
                    {
                        name: 'lookup',
                        title: 'Lookup',
                        description: 'Find alert(1) issues quickly',
                        annotations: {
                            readOnlyHint: true,
                            destructiveHint: false,
                            idempotentHint: true,
                        },
                    },
                ],
            },
        ]);
        expect(mcpClient.close).toHaveBeenCalledTimes(1);
        expect(connectedClient.transport.close).toHaveBeenCalledTimes(1);
    });

    test('truncates very large tool lists', async () => {
        const connectedClient = makeConnectedClient();
        const tools = Array.from({ length: 201 }, (_, index) => ({
            name: `tool-${index}`,
            description: 'x'.repeat(600),
            inputSchema: { type: 'object' },
        }));
        const mcpClient = {
            listTools: vi.fn().mockResolvedValue({ tools }),
            close: vi.fn().mockResolvedValue(undefined),
        };
        getConnectedMcpClients.mockResolvedValue([connectedClient]);
        createMCPClient.mockResolvedValue(mcpClient);

        const result = await getMcpToolMetadata({} as PrismaClient, 'user-1', 1);
        const entry = result[0];

        expect(entry.status).toBe('available');
        if (entry.status === 'available') {
            expect(entry.tools).toHaveLength(200);
            expect(entry.truncated).toBe(true);
            expect(entry.tools[0].description).toHaveLength(500);
        }
    });

    test('does not mark the list truncated when only text fields are shortened', async () => {
        const connectedClient = makeConnectedClient();
        const mcpClient = {
            listTools: vi.fn().mockResolvedValue({
                tools: [
                    {
                        name: 'tool',
                        description: 'x'.repeat(600),
                        inputSchema: { type: 'object' },
                    },
                ],
            }),
            close: vi.fn().mockResolvedValue(undefined),
        };
        getConnectedMcpClients.mockResolvedValue([connectedClient]);
        createMCPClient.mockResolvedValue(mcpClient);

        const result = await getMcpToolMetadata({} as PrismaClient, 'user-1', 1);
        const entry = result[0];

        expect(entry.status).toBe('available');
        if (entry.status === 'available') {
            expect(entry.truncated).toBeUndefined();
            expect(entry.tools[0].description).toHaveLength(500);
        }
    });

    test('maps safe auth failures without throwing the whole response', async () => {
        const connectedClient = makeConnectedClient();
        getConnectedMcpClients.mockResolvedValue([connectedClient]);
        createMCPClient.mockRejectedValue(Object.assign(new Error('unauthorized'), { statusCode: 401 }));

        const result = await getMcpToolMetadata({} as PrismaClient, 'user-1', 1);

        expect(result).toEqual([
            {
                status: 'error',
                serverId: 'server-1',
                reason: 'auth_failed',
            },
        ]);
        expect(connectedClient.transport.close).toHaveBeenCalledTimes(1);
        expect(loggerWarn).toHaveBeenCalled();
    });
});
