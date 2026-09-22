import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { notAuthenticated, serviceErrorSchema } from '@/lib/serviceError';
import { ErrorCode } from '@/lib/errorCodes';

const mocks = vi.hoisted(() => ({
    env: { EXPERIMENT_ASK_GH_ENABLED: 'false' },
    withOptionalAuth: vi.fn(),
    checkAskEntitlement: vi.fn(),
    createMessageStream: vi.fn(),
    findChat: vi.fn(),
    createChat: vi.fn(),
}));

vi.mock('@/lib/apiHandler', () => ({
    apiHandler: (handler: unknown) => handler,
}));
vi.mock('@/middleware/withAuth', () => ({
    withOptionalAuth: mocks.withOptionalAuth,
}));
vi.mock('@sourcebot/shared', () => ({
    env: mocks.env,
    createLogger: () => ({ error: vi.fn() }),
}));
vi.mock('@/lib/utils', () => ({
    isServiceError: (value: unknown) => serviceErrorSchema.safeParse(value).success,
}));
vi.mock('@/features/chat/utils.server', () => ({
    checkAskEntitlement: mocks.checkAskEntitlement,
}));
vi.mock('@/ee/features/chat/agent', () => ({
    createMessageStream: mocks.createMessageStream,
}));
vi.mock('@/features/chat/utils', () => ({}));
vi.mock('@/features/chat/llm.server', () => ({}));
vi.mock('@/features/chat/modelCapabilities.server', () => ({}));
vi.mock('@/features/chat/modelContextWindow.server', () => ({}));
vi.mock('@/ee/features/chat/llm.server', () => ({}));
vi.mock('@/ee/features/chat/askMcpAnalytics.server', () => ({}));
vi.mock('@/ee/features/chat/skills/commandResolution', () => ({}));
vi.mock('@/ee/features/chat/skills/skillAnalytics.server', () => ({}));
vi.mock('@/ee/features/audit/audit', () => ({}));
vi.mock('@/lib/posthog', () => ({}));
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));

const { POST: streamingPost } = await import('./route');
const { POST: blockingPost } = await import('../../chat/blocking/route');

// Stop requests that pass authentication at the next gate, before model or DB work.
const entitlementError = {
    statusCode: 403,
    errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
    message: 'Ask entitlement required',
};

beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkAskEntitlement.mockResolvedValue(entitlementError);
});

describe.each([
    {
        name: 'streaming',
        post: streamingPost,
        path: '/api/ee/chat',
        body: {
            id: 'chat-id',
            messages: [{ id: 'message-id', role: 'user', parts: [{ type: 'text', text: 'Explain this code' }] }],
            selectedSearchScopes: [],
            languageModel: { provider: 'openai', model: 'gpt-4o' },
        },
    },
    {
        name: 'blocking',
        post: blockingPost,
        path: '/api/chat/blocking',
        body: { query: 'Explain this code' },
    },
])('$name Ask authentication', ({ post, path, body }) => {
    test.each([
        { askGhEnabled: 'true', authenticated: false, denied: true },
        { askGhEnabled: 'true', authenticated: true, denied: false },
        { askGhEnabled: 'false', authenticated: false, denied: false },
        { askGhEnabled: 'false', authenticated: true, denied: false },
    ])('AskGH=$askGhEnabled, authenticated=$authenticated', async ({ askGhEnabled, authenticated, denied }) => {
        mocks.env.EXPERIMENT_ASK_GH_ENABLED = askGhEnabled;
        // Simulate an org with anonymous access enabled by allowing either context.
        mocks.withOptionalAuth.mockImplementation((callback) => callback({
            org: { id: 1 },
            user: authenticated ? { id: 'user-id' } : undefined,
            prisma: { chat: { findUnique: mocks.findChat, create: mocks.createChat } },
        }));

        const response = await post(new NextRequest(`https://sourcebot.example.com${path}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
        }));

        expect(response.status).toBe(denied ? 401 : entitlementError.statusCode);
        expect(await response.json()).toEqual(denied ? notAuthenticated() : entitlementError);
        expect(mocks.checkAskEntitlement).toHaveBeenCalledTimes(denied ? 0 : 1);
        expect(mocks.findChat).not.toHaveBeenCalled();
        expect(mocks.createChat).not.toHaveBeenCalled();
        expect(mocks.createMessageStream).not.toHaveBeenCalled();
    });
});
