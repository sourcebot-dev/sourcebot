import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ModelMessage } from 'ai';
import type { ProviderOptions } from '@ai-sdk/provider-utils';
import type { SBChatMessage, SBChatMessagePart } from '@/features/chat/types';
import type { PromptCacheStrategy } from './promptCaching';

const mockLogger = vi.hoisted(() => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
}));

const mockAi = vi.hoisted(() => ({
    convertToModelMessages: vi.fn(),
    createUIMessageStream: vi.fn(),
    latestCreateUIMessageStreamOptions: undefined as undefined | {
        execute: (args: { writer: unknown }) => Promise<void> | void;
    },
    streamText: vi.fn(),
}));

// Stable storage-backend mock so tests can control the bytes returned for a
// resolved attachment (the module returns the same object on every call).
const mockStorage = vi.hoisted(() => ({
    get: vi.fn(),
    put: vi.fn(),
    stat: vi.fn(),
    createReadStream: vi.fn(),
    delete: vi.fn(),
}));

vi.mock('@sourcebot/shared', () => ({
    createLogger: () => mockLogger,
    env: {
        SOURCEBOT_CHAT_FILE_MAX_CHARACTERS: 4000,
        SOURCEBOT_CHAT_MAX_STEP_COUNT: 8,
        SOURCEBOT_CHAT_MODEL_TEMPERATURE: 0,
        SOURCEBOT_TELEMETRY_PII_COLLECTION_ENABLED: 'false',
        SOURCEBOT_CHAT_PROMPT_CACHE_STATIC_TTL: '5m',
        SOURCEBOT_CHAT_PROMPT_CACHE_BREAK_DETECTION_ENABLED: 'false',
    },
    getDBConnectionString: () => 'postgresql://sourcebot:sourcebot@db.example.com:5432/sourcebot',
    getStorageBackend: () => mockStorage,
}));

vi.mock('server-only', () => ({}));

vi.mock('@/ee/features/chat/mcp/mcpClientFactory', () => ({
    getConnectedMcpClients: vi.fn(),
}));

vi.mock('@/ee/features/chat/mcp/mcpToolRegistry', () => ({
    buildMcpToolRegistry: vi.fn(() => []),
    searchMcpTools: vi.fn(() => []),
}));

vi.mock('@/ee/features/chat/mcp/mcpToolSets', () => ({
    getMcpTools: vi.fn(),
}));

vi.mock('@/features/git', () => ({
    getFileSource: vi.fn(),
}));

vi.mock('@/features/tools', () => {
    const createToolDefinition = (name: string) => ({
        name,
        title: name,
        description: `${name} description`,
        inputSchema: {},
        isReadOnly: true,
        isIdempotent: true,
        execute: vi.fn(),
    });

    return {
        findSymbolDefinitionsDefinition: createToolDefinition('find_symbol_definitions'),
        findSymbolReferencesDefinition: createToolDefinition('find_symbol_references'),
        getDiffDefinition: createToolDefinition('get_diff'),
        globDefinition: createToolDefinition('glob'),
        grepDefinition: createToolDefinition('grep'),
        listCommitsDefinition: createToolDefinition('list_commits'),
        listReposDefinition: createToolDefinition('list_repos'),
        listTreeDefinition: createToolDefinition('list_tree'),
        readFileDefinition: createToolDefinition('read_file'),
        readAttachmentDefinition: createToolDefinition('read_attachment'),
        toVercelAITool: vi.fn((definition: { name: string }) => ({
            name: definition.name,
        })),
    };
});

vi.mock('@/lib/entitlements', () => ({
    hasEntitlement: vi.fn(() => true),
}));

vi.mock('@/lib/posthog', () => ({
    captureEvent: vi.fn(),
}));

vi.mock('ai', async (importOriginal) => {
    const actual = await importOriginal<typeof import('ai')>();
    return {
        ...actual,
        convertToModelMessages: mockAi.convertToModelMessages,
        createUIMessageStream: mockAi.createUIMessageStream,
        streamText: mockAi.streamText,
    };
});

const { createMessageStream } = await import('./agent');
const { getPromptCacheStrategy } = await import('./promptCaching');

// Strategies reused across the prompt-caching tests below.
const anthropicStrategy = getPromptCacheStrategy('anthropic', true);
const noopStrategy = getPromptCacheStrategy('openai', true);

const listReposInput = {
    sort: 'name',
    page: 1,
    perPage: 30,
    direction: 'asc',
} as const;

const dynamicApprovalRespondedPart = {
    type: 'dynamic-tool',
    toolName: 'mcp_linear__save_issue',
    toolCallId: 'tool-call-1',
    state: 'approval-responded',
    input: { title: 'Issue' },
    approval: { id: 'approval-1', approved: true },
} satisfies SBChatMessagePart;

const staticApprovalRespondedPart = {
    type: 'tool-list_repos',
    toolCallId: 'tool-call-2',
    state: 'approval-responded',
    input: listReposInput,
    approval: { id: 'approval-2', approved: true },
} satisfies SBChatMessagePart;

const createUserMessage = (): SBChatMessage => ({
    id: 'user-message',
    role: 'user',
    parts: [
        {
            type: 'text',
            text: 'Create an issue',
        },
    ],
});

const createAssistantMessage = (parts: SBChatMessagePart[]): SBChatMessage => ({
    id: 'assistant-message',
    role: 'assistant',
    parts,
});

const createFakeStreamResult = () => ({
    response: Promise.resolve({ messages: [] }),
    steps: Promise.resolve([]),
    totalUsage: Promise.resolve({
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
    }),
    toUIMessageStream: vi.fn((options?: { onFinish?: () => Promise<void> | void }) => {
        void options?.onFinish?.();
        return {};
    }),
});

type FakePrepareStep = (opts: {
    steps: Array<{ toolResults: Array<{ toolName: string; output: unknown }> }>;
    stepNumber: number;
    model: unknown;
    messages: ModelMessage[];
}) =>
    | { messages?: ModelMessage[]; activeTools?: string[] }
    | Promise<{ messages?: ModelMessage[]; activeTools?: string[] }>;

interface StreamTextArgs {
    messages: ModelMessage[];
    system: Array<{ role: 'system'; content: string; providerOptions?: ProviderOptions }>;
    tools: Record<string, { providerOptions?: ProviderOptions }>;
    prepareStep?: FakePrepareStep;
}

const runCreateMessageStream = async (
    messages: SBChatMessage[],
    opts: {
        promptCacheStrategy?: PromptCacheStrategy;
        selectedRepos?: string[];
        prisma?: unknown;
        orgId?: number;
        acceptedModalities?: string[];
        supportedDocumentTypes?: string[];
    } = {},
): Promise<StreamTextArgs> => {
    const convertedLastTurn: ModelMessage = {
        role: 'assistant',
        content: 'converted-last-turn',
    };
    mockAi.convertToModelMessages.mockResolvedValue([convertedLastTurn]);
    mockAi.streamText.mockReturnValue(createFakeStreamResult());

    const props = {
        chatId: 'chat-id',
        messages,
        selectedRepos: opts.selectedRepos ?? [],
        prisma: opts.prisma ?? {},
        orgId: opts.orgId,
        acceptedModalities: opts.acceptedModalities,
        supportedDocumentTypes: opts.supportedDocumentTypes,
        model: {},
        modelName: 'test-model',
        // Default to a no-op strategy so the approval-continuation tests below
        // (which assert plain, unmarked messages) are unaffected by caching.
        promptCacheStrategy: opts.promptCacheStrategy ?? noopStrategy,
        onFinish: vi.fn(),
        onError: () => 'error',
    } as unknown as Parameters<typeof createMessageStream>[0];

    await createMessageStream(props);

    const execute = mockAi.latestCreateUIMessageStreamOptions?.execute;
    if (!execute) {
        throw new Error('Expected createUIMessageStream to capture execute callback.');
    }

    await execute({
        writer: {
            merge: vi.fn(),
            write: vi.fn(),
        },
    });

    const streamTextArgs = mockAi.streamText.mock.calls.at(-1)?.[0];
    if (!streamTextArgs || typeof streamTextArgs !== 'object' || !('messages' in streamTextArgs)) {
        throw new Error('Expected streamText to be called with messages.');
    }

    return streamTextArgs as StreamTextArgs;
};

beforeEach(() => {
    vi.clearAllMocks();
    mockAi.latestCreateUIMessageStreamOptions = undefined;
    mockAi.createUIMessageStream.mockImplementation((options: typeof mockAi.latestCreateUIMessageStreamOptions) => {
        mockAi.latestCreateUIMessageStreamOptions = options;
        return {};
    });
});

describe('createMessageStream approval continuation', () => {
    test.each([
        ['dynamic', dynamicApprovalRespondedPart],
        ['static', staticApprovalRespondedPart],
    ])('preserves the full last turn for %s approval responses', async (_kind, approvalPart) => {
        const assistantMessage = createAssistantMessage([
            {
                type: 'step-start',
            },
            {
                type: 'text',
                text: 'I have everything I need. Let me now create the issue.',
            },
            approvalPart,
        ]);

        const { messages: streamTextMessages } = await runCreateMessageStream([
            createUserMessage(),
            assistantMessage,
        ]);

        expect(mockAi.convertToModelMessages).toHaveBeenCalledWith(
            [assistantMessage],
            { ignoreIncompleteToolCalls: true }
        );
        expect(streamTextMessages).toEqual([
            {
                role: 'user',
                content: 'Create an issue',
            },
            {
                role: 'assistant',
                content: 'converted-last-turn',
            },
        ]);
    });

    test('does not treat untagged latest approval-continuation text as a prior assistant answer', async () => {
        const assistantMessage = createAssistantMessage([
            {
                type: 'step-start',
            },
            {
                type: 'text',
                text: 'I have everything I need. Let me now create the Linear issue!',
            },
            dynamicApprovalRespondedPart,
        ]);

        const { messages: streamTextMessages } = await runCreateMessageStream([
            createUserMessage(),
            assistantMessage,
        ]);

        expect(streamTextMessages).not.toContainEqual({
            role: 'assistant',
            content: [
                {
                    type: 'text',
                    text: 'I have everything I need. Let me now create the Linear issue!',
                },
            ],
        });
    });
});

const EPHEMERAL = { type: 'ephemeral' };

describe('createMessageStream prompt caching', () => {
    test('marks the static system block for the Anthropic family', async () => {
        const { system, messages } = await runCreateMessageStream([createUserMessage()], {
            promptCacheStrategy: anthropicStrategy,
        });

        // No repos / files / MCP tools → only the static system block.
        expect(system).toHaveLength(1);
        expect(system[0].providerOptions?.anthropic?.cacheControl).toEqual(EPHEMERAL);

        // The tail marker is applied per-step in prepareStep, not on the messages
        // handed to streamText — those stay unmarked.
        for (const message of messages) {
            expect(message.providerOptions).toBeUndefined();
        }
    });

    test('moves the tail marker onto the last message of each step via prepareStep', async () => {
        const { prepareStep } = await runCreateMessageStream([createUserMessage()], {
            promptCacheStrategy: anthropicStrategy,
        });
        expect(prepareStep).toBeTypeOf('function');

        // Step 0: a single input message → marker lands on it.
        const step0 = await prepareStep!({
            steps: [],
            stepNumber: 0,
            model: {},
            messages: [{ role: 'user', content: 'q' }],
        });
        expect(step0.messages?.at(-1)?.providerOptions?.anthropic?.cacheControl).toEqual(EPHEMERAL);

        // Continuation step: the marker rides the NEW last message, and only it —
        // earlier messages (including the prior tail) carry no marker.
        const stepN = await prepareStep!({
            steps: [],
            stepNumber: 1,
            model: {},
            messages: [
                { role: 'user', content: 'q' },
                { role: 'assistant', content: 'searching' },
                { role: 'assistant', content: 'tool output' },
            ],
        });
        const out = stepN.messages!;
        expect(out[0].providerOptions?.anthropic?.cacheControl).toBeUndefined();
        expect(out[1].providerOptions?.anthropic?.cacheControl).toBeUndefined();
        expect(out.at(-1)?.providerOptions?.anthropic?.cacheControl).toEqual(EPHEMERAL);
    });

    test('prepareStep adds no tail marker for non-Anthropic providers', async () => {
        // Force MCP so prepareStep exists even without a tail marker.
        const { buildMcpToolRegistry } = await import('@/ee/features/chat/mcp/mcpToolRegistry');
        vi.mocked(buildMcpToolRegistry).mockReturnValueOnce([
            { name: 'mcp_linear__save_issue', description: 'Save an issue', serverName: 'linear' },
        ]);

        const { prepareStep } = await runCreateMessageStream([createUserMessage()], {
            promptCacheStrategy: noopStrategy,
        });
        expect(prepareStep).toBeTypeOf('function');

        const result = await prepareStep!({
            steps: [],
            stepNumber: 1,
            model: {},
            messages: [
                { role: 'user', content: 'q' },
                { role: 'assistant', content: 'a' },
            ],
        });

        // activeTools still managed (MCP), but no message override / marker.
        expect(result.messages).toBeUndefined();
        expect(result.activeTools).toContain('tool_request_activation');
    });

    test('leaves the dynamic system block uncached', async () => {
        const { system } = await runCreateMessageStream([createUserMessage()], {
            promptCacheStrategy: anthropicStrategy,
            selectedRepos: ['github.com/acme/repo'],
        });

        // Static checkpoint + dynamic (per-conversation) block.
        expect(system).toHaveLength(2);
        expect(system[0].providerOptions?.anthropic?.cacheControl).toEqual(EPHEMERAL);
        expect(system[1].providerOptions).toBeUndefined();
        expect(system[1].content).toContain('<selected_repositories>');
    });

    test('does not mark the tools block, so mid-run activeTools growth never busts it', async () => {
        const { buildMcpToolRegistry } = await import('@/ee/features/chat/mcp/mcpToolRegistry');
        vi.mocked(buildMcpToolRegistry).mockReturnValueOnce([
            { name: 'mcp_linear__save_issue', description: 'Save an issue', serverName: 'linear' },
        ]);

        const { tools } = await runCreateMessageStream([createUserMessage()], {
            promptCacheStrategy: anthropicStrategy,
        });

        // The static checkpoint sits on the system block (after the full tools
        // section in render order), so no tool definition carries a breakpoint.
        for (const tool of Object.values(tools)) {
            expect(tool.providerOptions?.anthropic?.cacheControl).toBeUndefined();
        }
    });

    test.each([
        ['non-Anthropic provider', () => getPromptCacheStrategy('openai', true)],
        ['caching disabled', () => getPromptCacheStrategy('anthropic', false)],
    ])('emits no cache markers for %s (multi-provider regression guard)', async (_label, makeStrategy) => {
        const { buildMcpToolRegistry } = await import('@/ee/features/chat/mcp/mcpToolRegistry');
        vi.mocked(buildMcpToolRegistry).mockReturnValueOnce([
            { name: 'mcp_linear__save_issue', description: 'Save an issue', serverName: 'linear' },
        ]);

        const { system, messages, tools } = await runCreateMessageStream([createUserMessage()], {
            promptCacheStrategy: makeStrategy(),
            selectedRepos: ['github.com/acme/repo'],
        });

        for (const block of system) {
            expect(block.providerOptions).toBeUndefined();
        }
        for (const message of messages) {
            expect(message.providerOptions).toBeUndefined();
        }
        for (const tool of Object.values(tools)) {
            expect(tool.providerOptions).toBeUndefined();
        }
    });

    test('builds a byte-identical static prompt regardless of repos', async () => {
        const first = await runCreateMessageStream([createUserMessage()], {
            promptCacheStrategy: anthropicStrategy,
            selectedRepos: ['github.com/acme/one'],
        });
        const second = await runCreateMessageStream([createUserMessage()], {
            promptCacheStrategy: anthropicStrategy,
            selectedRepos: ['github.com/acme/two', 'github.com/acme/three'],
        });

        expect(first.system[0].content).toBe(second.system[0].content);
    });
});

const createUserMessageWithPdf = (): SBChatMessage => ({
    id: 'user-message',
    role: 'user',
    parts: [
        {
            type: 'text',
            text: 'Summarize this document',
        },
        {
            type: 'data-attachment',
            data: {
                kind: 'blob',
                attachmentId: 'att-pdf-1',
                filename: 'doc.pdf',
                mediaType: 'application/pdf',
                sizeBytes: 1234,
            },
        },
    ],
});

describe('createMessageStream PDF attachments', () => {
    const pdfBytes = Buffer.from('%PDF-1.7 fake pdf bytes');

    const prismaWithPdf = () => ({
        attachment: {
            findMany: vi.fn().mockResolvedValue([
                { id: 'att-pdf-1', storageKey: 'org/att-pdf-1', mediaType: 'application/pdf' },
            ]),
        },
    });

    test('sends the PDF as a model `file` part when the model supports PDF documents', async () => {
        mockStorage.get.mockResolvedValue(pdfBytes);

        const { messages } = await runCreateMessageStream([createUserMessageWithPdf()], {
            prisma: prismaWithPdf(),
            orgId: 1,
            acceptedModalities: ['text'],
            supportedDocumentTypes: ['pdf'],
        });

        const userMessage = messages[0];
        expect(Array.isArray(userMessage.content)).toBe(true);
        const parts = userMessage.content as Array<{ type: string; mediaType?: string; data?: Buffer }>;
        const filePart = parts.find((part) => part.type === 'file');
        expect(filePart).toBeDefined();
        expect(filePart?.mediaType).toBe('application/pdf');
        expect(filePart?.data).toEqual(pdfBytes);
    });

    test('omits the PDF and leaves a degrade note when the model does not support PDF documents', async () => {
        const findMany = vi.fn().mockResolvedValue([]);
        mockStorage.get.mockResolvedValue(pdfBytes);

        const { messages } = await runCreateMessageStream([createUserMessageWithPdf()], {
            prisma: { attachment: { findMany } },
            orgId: 1,
            acceptedModalities: ['text'],
            supportedDocumentTypes: [],
        });

        const userMessage = messages[0];
        // No accepted media → content is a plain string carrying the degrade note.
        expect(typeof userMessage.content).toBe('string');
        expect(userMessage.content as string).toContain('does not support that file type');
        // Fail-closed: an unsupported document is never read from storage.
        expect(findMany).not.toHaveBeenCalled();
    });
});
