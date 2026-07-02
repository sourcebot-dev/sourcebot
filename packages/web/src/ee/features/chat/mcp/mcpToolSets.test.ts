import { expect, test, describe, vi, beforeEach } from 'vitest';
import { McpServerToolPermission, Prisma } from '@sourcebot/db';
import type { McpToolSet } from './mcpClientFactory';

// --- Mocks ---

const mockCreateMCPClient = vi.fn();
const mockLogger = vi.hoisted(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
}));
const mockServerToolUpsert = vi.hoisted(() => vi.fn());
const mockServerToolUpdate = vi.hoisted(() => vi.fn());
const mockServerToolCreateMany = vi.hoisted(() => vi.fn());
const mockServerToolFindMany = vi.hoisted(() => vi.fn());
const mockCaptureEvent = vi.hoisted(() => vi.fn());
const mockRedisGet = vi.hoisted(() => vi.fn());
const mockRedisSet = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
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
        mcpServerTool: {
            createMany: mockServerToolCreateMany,
            findMany: mockServerToolFindMany,
            upsert: mockServerToolUpsert,
            update: mockServerToolUpdate,
        },
    },
}));

vi.mock('@/lib/posthog', () => ({
    captureEvent: mockCaptureEvent,
}));

vi.mock('@/lib/redis', () => ({
    getRedisClient: () => ({
        get: (...args: unknown[]) => mockRedisGet(...args),
        set: (...args: unknown[]) => mockRedisSet(...args),
    }),
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
        orgId: 1,
        userId: 'user-id',
        serverId: 'server-id',
        sanitizedName: overrides.serverName.toLowerCase(),
        serverUrl: `https://${overrides.serverName.toLowerCase()}.example.com/mcp`,
        serverUpdatedAt: new Date('2026-01-01T00:00:00.000Z'),
        requestedOAuthScopes: [],
        transport: {} as McpToolSet['transport'],
        ...overrides,
    };
}

// --- Tests ---

// Import after mocks are set up
const { getMcpTools, sanitizeMcpToolNameForModel } = await import('./mcpToolSets');

beforeEach(() => {
    vi.clearAllMocks();
    mockServerToolCreateMany.mockResolvedValue({ count: 0 });
    mockServerToolFindMany.mockResolvedValue([]);
    mockServerToolUpsert.mockResolvedValue({});
    mockServerToolUpdate.mockResolvedValue({});
    mockCaptureEvent.mockResolvedValue(undefined);
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
});

describe('sanitizeMcpToolNameForModel', () => {
    test('replaces provider-invalid characters with underscores', () => {
        expect(sanitizeMcpToolNameForModel('mcp_backstage__catalog.query-catalog-entities'))
            .toBe('mcp_backstage__catalog_query_catalog_entities');
    });

    test('returns an underscore for an empty name', () => {
        expect(sanitizeMcpToolNameForModel('')).toBe('_');
    });
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

    test('sanitizes model-facing keys for MCP tools with punctuation', async () => {
        const mockClient = createMockMcpClient([
            { name: 'catalog.query-catalog-entities', description: 'Query catalog entities' },
        ]);
        mockCreateMCPClient.mockResolvedValue(mockClient);

        const result = await getMcpTools([
            createMockClient({ serverId: 'server-backstage', serverName: 'Backstage' }),
        ]);

        expect(Object.keys(result.tools)).toEqual([
            'mcp_backstage__catalog_query_catalog_entities',
        ]);

        const tool = result.tools['mcp_backstage__catalog_query_catalog_entities'];
        await expect(
            tool.execute({ filter: 'kind=component' }, { messages: [], toolCallId: 'test' })
        ).resolves.toEqual({ content: [{ type: 'text', text: 'result' }] });

        expect(mockServerToolUpsert).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                mcpServerId_toolName: {
                    mcpServerId: 'server-backstage',
                    toolName: 'catalog.query-catalog-entities',
                },
            },
        }));
        expect(mockCaptureEvent).toHaveBeenCalledWith('ask_mcp_tool_call_completed', expect.objectContaining({
            serverId: 'server-backstage',
            toolName: 'catalog.query-catalog-entities',
            success: true,
        }));
    });

    test('adds stable suffixes when sanitized tool names collide', async () => {
        const mockClient = createMockMcpClient([
            { name: 'catalog.query', description: 'Query catalog' },
            { name: 'catalog_query', description: 'Query catalog with underscore' },
        ]);
        mockCreateMCPClient.mockResolvedValue(mockClient);

        const result = await getMcpTools([
            createMockClient({ serverName: 'Backstage' }),
        ]);

        const toolNames = Object.keys(result.tools);
        expect(toolNames).toHaveLength(2);
        expect(new Set(toolNames).size).toBe(2);
        expect(toolNames).not.toContain('mcp_backstage__catalog_query');
        expect(toolNames.every((toolName) => /^mcp_backstage__catalog_query_[0-9a-f]{8}$/.test(toolName))).toBe(true);
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

    test('uses cached tool definitions when available', async () => {
        const cachedTool = {
            execute: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'result' }] }),
            description: 'Cached tool',
            inputSchema: {},
        };
        const mockClient = {
            listTools: vi.fn().mockResolvedValue({ tools: [{ name: 'live_tool', description: 'Live tool' }] }),
            toolsFromDefinitions: vi.fn().mockReturnValue({ cached_tool: cachedTool }),
            close: vi.fn().mockResolvedValue(undefined),
            tools: vi.fn().mockResolvedValue({ cached_tool: cachedTool }),
        };
        mockRedisGet.mockResolvedValueOnce(JSON.stringify({
            tools: [
                { name: 'cached_tool', description: 'Cached tool', inputSchema: { type: 'object' } },
            ],
        }));
        mockCreateMCPClient.mockResolvedValue(mockClient);

        const result = await getMcpTools([
            createMockClient({ serverName: 'Linear' }),
        ]);

        expect(mockClient.listTools).not.toHaveBeenCalled();
        expect(mockClient.toolsFromDefinitions).toHaveBeenCalledWith({
            tools: [
                { name: 'cached_tool', description: 'Cached tool', inputSchema: { type: 'object' } },
            ],
        });
        expect(Object.keys(result.tools)).toEqual(['mcp_linear__cached_tool']);
    });

    test('caches live tool definitions after a cache miss', async () => {
        const mockClient = createMockMcpClient([
            { name: 'list_issues', description: 'List issues' },
        ]);
        mockCreateMCPClient.mockResolvedValue(mockClient);

        await getMcpTools([
            createMockClient({
                serverName: 'Linear',
                requestedOAuthScopes: ['repo'],
            }),
        ]);

        expect(mockClient.listTools).toHaveBeenCalledOnce();
        expect(mockRedisSet).toHaveBeenCalledWith(
            expect.stringMatching(/^mcp:list-tools:v1:1:user-id:server-id:/),
            JSON.stringify({ tools: [{ name: 'list_issues', description: 'List issues' }] }),
            'EX',
            3600,
        );
    });

    test('newly discovered read-only tool defaults to allowed', async () => {
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

    test('allowed tool does not get needsApproval', async () => {
        mockServerToolFindMany.mockResolvedValueOnce([
            {
                mcpServerId: 'server-id',
                toolName: 'list_issues',
                permission: McpServerToolPermission.ALLOWED,
            },
        ]);
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

    test('disabled tool is not exposed to the agent', async () => {
        mockServerToolFindMany.mockResolvedValueOnce([
            {
                mcpServerId: 'server-id',
                toolName: 'delete_issue',
                permission: McpServerToolPermission.DISABLED,
            },
        ]);
        const mockClient = createMockMcpClient([
            { name: 'delete_issue', description: 'Delete issue' },
        ]);
        mockCreateMCPClient.mockResolvedValue(mockClient);

        const result = await getMcpTools([
            createMockClient({ serverName: 'Linear' }),
        ]);

        expect(result.tools).toEqual({});
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
        expect(mockServerToolUpsert).not.toHaveBeenCalled();
        expect(mockServerToolUpdate).not.toHaveBeenCalled();
        expect(mockCaptureEvent).toHaveBeenCalledWith('ask_mcp_tool_call_completed', expect.objectContaining({
            serverUrl: 'https://linear.example.com/mcp',
            toolName: 'create_issue',
            success: false,
            failureReason: 'Error',
        }));
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

        expect(mockServerToolUpsert).toHaveBeenCalledWith({
            where: {
                mcpServerId_toolName: {
                    mcpServerId: 'server-linear',
                    toolName: 'create_issue',
                },
            },
            create: {
                mcpServerId: 'server-linear',
                toolName: 'create_issue',
                callCount: 1,
            },
            update: {
                callCount: { increment: 1 },
            },
        });
        expect(mockServerToolUpdate).not.toHaveBeenCalled();
        expect(mockCaptureEvent).toHaveBeenCalledWith('ask_mcp_tool_call_completed', expect.objectContaining({
            source: 'sourcebot-ask-agent',
            serverId: 'server-linear',
            serverUrl: 'https://linear.example.com/mcp',
            toolName: 'create_issue',
            success: true,
        }));
    });

    test('tool execute wrapper includes analytics context in tool completion events', async () => {
        const mockClient = createMockMcpClient([
            { name: 'create_issue', description: 'Create issue' },
        ]);
        mockCreateMCPClient.mockResolvedValue(mockClient);

        const result = await getMcpTools([
            createMockClient({ serverId: 'server-linear', serverName: 'Linear' }),
        ], {
            chatId: 'chat-id',
            traceId: 'trace-id',
            source: 'sourcebot-ask-agent',
        });

        const tool = result.tools['mcp_linear__create_issue'];
        await tool.execute({ title: 'My Issue' }, { messages: [], toolCallId: 'test' });

        expect(mockCaptureEvent).toHaveBeenCalledWith('ask_mcp_tool_call_completed', expect.objectContaining({
            chatId: 'chat-id',
            traceId: 'trace-id',
            source: 'sourcebot-ask-agent',
        }));
    });

    test('tool execute wrapper waits for the counter increment before resolving', async () => {
        let resolveCounter: (() => void) | undefined;
        mockServerToolUpsert.mockImplementationOnce(() => new Promise<void>((resolve) => {
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
        const execution = Promise.resolve(tool.execute({}, { messages: [], toolCallId: 'test' }));
        let didResolve = false;
        const observedExecution = execution.then((value) => {
            didResolve = true;
            return value;
        });

        await vi.waitFor(() => {
            expect(mockServerToolUpsert).toHaveBeenCalledTimes(1);
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
        mockServerToolUpsert.mockRejectedValueOnce(uniqueConflict);

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

        expect(mockServerToolUpdate).toHaveBeenCalledWith({
            where: {
                mcpServerId_toolName: {
                    mcpServerId: 'server-linear',
                    toolName: 'create_issue',
                },
            },
            data: {
                callCount: { increment: 1 },
            },
        });
    });
});
