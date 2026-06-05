import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ModelMessage } from 'ai';
import type { SBChatMessage, SBChatMessagePart } from '@/features/chat/types';

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

vi.mock('@sourcebot/shared', () => ({
    createLogger: () => mockLogger,
    env: {
        SOURCEBOT_CHAT_FILE_MAX_CHARACTERS: 4000,
        SOURCEBOT_CHAT_MAX_STEP_COUNT: 8,
        SOURCEBOT_CHAT_MODEL_TEMPERATURE: 0,
        SOURCEBOT_TELEMETRY_PII_COLLECTION_ENABLED: 'false',
    },
    getDBConnectionString: () => 'postgresql://sourcebot:sourcebot@db.example.com:5432/sourcebot',
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
    response: Promise.resolve(new Response()),
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

const runCreateMessageStream = async (messages: SBChatMessage[]) => {
    const convertedLastTurn: ModelMessage = {
        role: 'assistant',
        content: 'converted-last-turn',
    };
    mockAi.convertToModelMessages.mockResolvedValue([convertedLastTurn]);
    mockAi.streamText.mockReturnValue(createFakeStreamResult());

    const props = {
        chatId: 'chat-id',
        messages,
        selectedRepos: [],
        prisma: {},
        model: {},
        modelName: 'test-model',
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

    return streamTextArgs.messages as ModelMessage[];
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

        const streamTextMessages = await runCreateMessageStream([
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

        const streamTextMessages = await runCreateMessageStream([
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
