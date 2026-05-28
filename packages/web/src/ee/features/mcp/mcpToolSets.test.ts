import { expect, test, describe, vi, beforeEach } from 'vitest';
import { Prisma } from '@sourcebot/db';
import type { McpToolSet } from './mcpClientFactory';

// --- Mocks ---

const mockCreateMCPClient = vi.fn();
const mockLogger = vi.hoisted(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
}));
const mockToolCallCountUpsert = vi.hoisted(() => vi.fn());
const mockToolCallCountUpdate = vi.hoisted(() => vi.fn());

vi.mock('@ai-sdk/mcp', () => ({
    createMCPClient: (...args: unknown[]) => mockCreateMCPClient(...args),
}));

vi.mock('@sourcebot/shared', () => ({
    createLogger: () => mockLogger,
    env: {
        SOURCEBOT_MCP_TOOL_CALL_TIMEOUT_MS: 5000,
    },
}));

vi.mock('@/prisma', () => ({
    __unsafePrisma: {
        mcpServerToolCallCount: {
            upsert: mockToolCallCountUpsert,
            update: mockToolCallCountUpdate,
        },
    },
}));

vi.mock('ai', () => ({
    jsonSchema: vi.fn((schema: unknown, opts: unknown) => ({ schema, ...(opts as object) })),
}));

// --- Helpers ---

interface MockToolDef {
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
    annotations?: Record<string, unknown>;
}

function createMockMcpClient(toolDefs: MockToolDef[]) {
    const toolRecord: Record<string, { execute: ReturnType<typeof vi.fn>; description: string | undefined; inputSchema: unknown }> = {};
    for (const def of toolDefs) {
        toolRecord[def.name] = {
            execute: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'result' }] }),
            description: def.description,
            inputSchema: def.inputSchema ?? {},
        };
    }

    return {
        listTools: vi.fn().mockResolvedValue({ tools: toolDefs }),
        toolsFromDefinitions: vi.fn().mockReturnValue(toolRecord),
        close: vi.fn().mockResolvedValue(undefined),
        tools: vi.fn().mockResolvedValue(toolRecord),
    };
}

function createMockClient(overrides: Partial<McpToolSet> & { serverName: string }): McpToolSet {
    return {
        serverId: 'server-id',
        sanitizedName: overrides.serverName.toLowerCase(),
        serverUrl: `https://${overrides.serverName.toLowerCase()}.example.com/mcp`,
        transport: {} as McpToolSet['transport'],
        ...overrides,
    };
}

// --- Tests ---

// Import after mocks are set up
const { getMcpTools } = await import('./mcpToolSets');

beforeEach(() => {
    vi.clearAllMocks();
    mockToolCallCountUpsert.mockResolvedValue({});
    mockToolCallCountUpdate.mockResolvedValue({});
});

describe('getMcpTools', () => {
    test('single server with single tool produces correctly namespaced key', async () => {
        const mockClient = createMockMcpClient([
            { name: 'list_issues', description: 'List issues' },
        ]);
        mockCreateMCPClient.mockResolvedValue(mockClient);

        const result = await getMcpTools([
            createMockClient({ serverName: 'Linear' }),
        ]);

        expect(Object.keys(result.tools)).toEqual(['mcp_linear__list_issues']);
        expect(result.failedServers).toEqual([]);
    });

    test('multiple servers produce tools with distinct prefixes', async () => {
        const linearClient = createMockMcpClient([
            { name: 'list_issues', description: 'List issues' },
        ]);
        const githubClient = createMockMcpClient([
            { name: 'search_repos', description: 'Search repos' },
        ]);

        mockCreateMCPClient
            .mockResolvedValueOnce(linearClient)
            .mockResolvedValueOnce(githubClient);

        const result = await getMcpTools([
            createMockClient({ serverName: 'Linear' }),
            createMockClient({ serverName: 'GitHub' }),
        ]);

        const toolNames = Object.keys(result.tools);
        expect(toolNames).toContain('mcp_linear__list_issues');
        expect(toolNames).toContain('mcp_github__search_repos');
    });

    test('read-only tool does NOT get needsApproval', async () => {
        const mockClient = createMockMcpClient([
            { name: 'list_issues', description: 'List issues', annotations: { readOnlyHint: true } },
        ]);
        mockCreateMCPClient.mockResolvedValue(mockClient);

        const result = await getMcpTools([
            createMockClient({ serverName: 'Linear' }),
        ]);

        const tool = result.tools['mcp_linear__list_issues'];
        expect(tool).toBeDefined();
        expect('needsApproval' in tool).toBe(false);
    });

    test('non-read-only tool gets needsApproval: true', async () => {
        const mockClient = createMockMcpClient([
            { name: 'create_issue', description: 'Create issue' },
        ]);
        mockCreateMCPClient.mockResolvedValue(mockClient);

        const result = await getMcpTools([
            createMockClient({ serverName: 'Linear' }),
        ]);

        const tool = result.tools['mcp_linear__create_issue'];
        expect(tool).toBeDefined();
        expect(tool).toHaveProperty('needsApproval', true);
    });

    test('failed server connection adds to failedServers array', async () => {
        const error = new Error('Connection refused client_secret=client-secret access_token=access-token');
        Object.assign(error, {
            response: {
                status: 502,
                body: 'client_secret=client-secret access_token=access-token',
            },
        });
        mockCreateMCPClient.mockRejectedValue(error);

        const result = await getMcpTools([
            createMockClient({ serverName: 'BrokenServer' }),
        ]);

        expect(result.failedServers).toEqual(['BrokenServer']);
        expect(Object.keys(result.tools)).toEqual([]);
        expect(mockLogger.error).toHaveBeenCalledWith('Failed to get tools from MCP server.', {
            serverId: 'server-id',
            sanitizedName: 'brokenserver',
            error: {
                errorClass: 'Error',
                statusCode: 502,
            },
        });
        expect(JSON.stringify(mockLogger.error.mock.calls)).not.toContain('client-secret');
        expect(JSON.stringify(mockLogger.error.mock.calls)).not.toContain('access-token');
    });

    test('failed server does not prevent other servers from working', async () => {
        const goodClient = createMockMcpClient([
            { name: 'list_issues', description: 'List issues' },
        ]);

        mockCreateMCPClient
            .mockRejectedValueOnce(new Error('Connection refused'))
            .mockResolvedValueOnce(goodClient);

        const result = await getMcpTools([
            createMockClient({ serverName: 'BrokenServer' }),
            createMockClient({ serverName: 'Linear' }),
        ]);

        expect(result.failedServers).toEqual(['BrokenServer']);
        expect(Object.keys(result.tools)).toEqual(['mcp_linear__list_issues']);
    });

    test('generates favicon URL from server URL origin', async () => {
        const mockClient = createMockMcpClient([
            { name: 'tool', description: 'A tool' },
        ]);
        mockCreateMCPClient.mockResolvedValue(mockClient);

        const result = await getMcpTools([
            createMockClient({ serverName: 'Linear', serverUrl: 'https://api.linear.app/mcp' }),
        ]);

        expect(result.serverFaviconUrls['linear']).toBe(
            'https://www.google.com/s2/favicons?domain=https://api.linear.app&sz=32'
        );
    });

    test('cleanup function calls close on all clients', async () => {
        const client1 = createMockMcpClient([{ name: 'tool1', description: 'Tool 1' }]);
        const client2 = createMockMcpClient([{ name: 'tool2', description: 'Tool 2' }]);

        mockCreateMCPClient
            .mockResolvedValueOnce(client1)
            .mockResolvedValueOnce(client2);

        const result = await getMcpTools([
            createMockClient({ serverName: 'Server1' }),
            createMockClient({ serverName: 'Server2' }),
        ]);

        await result.cleanup();

        expect(client1.close).toHaveBeenCalledOnce();
        expect(client2.close).toHaveBeenCalledOnce();
    });

    test('cleanup handles errors in close gracefully', async () => {
        const client1 = createMockMcpClient([{ name: 'tool1', description: 'Tool 1' }]);
        const client2 = createMockMcpClient([{ name: 'tool2', description: 'Tool 2' }]);
        client1.close.mockRejectedValue(new Error('Close failed'));

        mockCreateMCPClient
            .mockResolvedValueOnce(client1)
            .mockResolvedValueOnce(client2);

        const result = await getMcpTools([
            createMockClient({ serverName: 'Server1' }),
            createMockClient({ serverName: 'Server2' }),
        ]);

        // Should not throw
        await expect(result.cleanup()).resolves.toBeUndefined();
        expect(client2.close).toHaveBeenCalledOnce();
    });

    test('empty clients array returns empty result', async () => {
        const result = await getMcpTools([]);

        expect(result.tools).toEqual({});
        expect(result.failedServers).toEqual([]);
        expect(result.serverFaviconUrls).toEqual({});
        expect(typeof result.cleanup).toBe('function');
    });

    test('tool schema validation rejects invalid input', async () => {
        const mockClient = createMockMcpClient([
            {
                name: 'create_issue',
                description: 'Create issue',
                inputSchema: {
                    type: 'object',
                    properties: { title: { type: 'string' } },
                },
            },
        ]);
        mockCreateMCPClient.mockResolvedValue(mockClient);

        const result = await getMcpTools([
            createMockClient({ serverName: 'Linear' }),
        ]);

        const tool = result.tools['mcp_linear__create_issue'];
        // The inputSchema should have a validate function from our jsonSchema mock
        const schema = tool.inputSchema as { validate?: (value: unknown) => Promise<{ success: boolean; error?: Error }> };
        expect(schema.validate).toBeDefined();

        if (schema.validate) {
            // Valid input
            const validResult = await schema.validate({ title: 'My Issue' });
            expect(validResult.success).toBe(true);

            // Invalid input (extra property not allowed because additionalProperties: false)
            const invalidResult = await schema.validate({ title: 'My Issue', bogus: 'field' });
            expect(invalidResult.success).toBe(false);
        }
    });

    test('tool execute wrapper propagates non-timeout errors', async () => {
        const originalError = new Error('External API failed');
        const mockClient = createMockMcpClient([
            { name: 'create_issue', description: 'Create issue' },
        ]);
        // Override the execute to reject
        const toolRecord = mockClient.toolsFromDefinitions();
        toolRecord['create_issue'].execute.mockRejectedValue(originalError);

        mockCreateMCPClient.mockResolvedValue(mockClient);

        const result = await getMcpTools([
            createMockClient({ serverName: 'Linear' }),
        ]);

        const tool = result.tools['mcp_linear__create_issue'];
        await expect(
            tool.execute({}, { messages: [], toolCallId: 'test' })
        ).rejects.toThrow('External API failed');
        expect(mockToolCallCountUpsert).not.toHaveBeenCalled();
        expect(mockToolCallCountUpdate).not.toHaveBeenCalled();
    });

    test('tool execute wrapper increments the raw tool call counter after success', async () => {
        const mockClient = createMockMcpClient([
            { name: 'create_issue', description: 'Create issue' },
        ]);
        mockCreateMCPClient.mockResolvedValue(mockClient);

        const result = await getMcpTools([
            createMockClient({ serverId: 'server-linear', serverName: 'Linear' }),
        ]);

        const tool = result.tools['mcp_linear__create_issue'];
        await expect(
            tool.execute({ title: 'My Issue' }, { messages: [], toolCallId: 'test' })
        ).resolves.toEqual({ content: [{ type: 'text', text: 'result' }] });

        expect(mockToolCallCountUpsert).toHaveBeenCalledWith({
            where: {
                mcpServerId_toolName: {
                    mcpServerId: 'server-linear',
                    toolName: 'create_issue',
                },
            },
            create: {
                mcpServerId: 'server-linear',
                toolName: 'create_issue',
                count: 1,
            },
            update: {
                count: { increment: 1 },
            },
        });
        expect(mockToolCallCountUpdate).not.toHaveBeenCalled();
    });

    test('tool execute wrapper waits for the counter increment before resolving', async () => {
        let resolveCounter: (() => void) | undefined;
        mockToolCallCountUpsert.mockImplementationOnce(() => new Promise<void>((resolve) => {
            resolveCounter = resolve;
        }));

        const mockClient = createMockMcpClient([
            { name: 'list_issues', description: 'List issues', annotations: { readOnlyHint: true } },
        ]);
        mockCreateMCPClient.mockResolvedValue(mockClient);

        const result = await getMcpTools([
            createMockClient({ serverId: 'server-linear', serverName: 'Linear' }),
        ]);

        const tool = result.tools['mcp_linear__list_issues'];
        const execution = tool.execute({}, { messages: [], toolCallId: 'test' });
        let didResolve = false;
        const observedExecution = execution.then((value) => {
            didResolve = true;
            return value;
        });

        await vi.waitFor(() => {
            expect(mockToolCallCountUpsert).toHaveBeenCalledTimes(1);
        });
        await Promise.resolve();

        expect(resolveCounter).toBeDefined();
        expect(didResolve).toBe(false);

        resolveCounter?.();

        await expect(observedExecution).resolves.toEqual({ content: [{ type: 'text', text: 'result' }] });
        expect(didResolve).toBe(true);
    });

    test('tool execute wrapper retries with an atomic update after a unique conflict', async () => {
        const uniqueConflict = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: '0',
        });
        mockToolCallCountUpsert.mockRejectedValueOnce(uniqueConflict);

        const mockClient = createMockMcpClient([
            { name: 'create_issue', description: 'Create issue' },
        ]);
        mockCreateMCPClient.mockResolvedValue(mockClient);

        const result = await getMcpTools([
            createMockClient({ serverId: 'server-linear', serverName: 'Linear' }),
        ]);

        const tool = result.tools['mcp_linear__create_issue'];
        await expect(
            tool.execute({ title: 'My Issue' }, { messages: [], toolCallId: 'test' })
        ).resolves.toEqual({ content: [{ type: 'text', text: 'result' }] });

        expect(mockToolCallCountUpdate).toHaveBeenCalledWith({
            where: {
                mcpServerId_toolName: {
                    mcpServerId: 'server-linear',
                    toolName: 'create_issue',
                },
            },
            data: {
                count: { increment: 1 },
            },
        });
    });
});
