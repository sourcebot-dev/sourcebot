import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChatStatus } from 'ai';
import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { MCP_RECONNECT_SESSION_STORAGE_KEY } from '@/features/chat/constants';
import { SBChatMessage } from '@/features/chat/types';
import { getUserMessageText } from '@/features/chat/utils';
import { useMcpReconnectController } from './useMcpReconnectController';

const mocks = vi.hoisted(() => ({
    connectMcpToAsk: vi.fn(),
    getMcpServersWithStatus: vi.fn(),
    toast: vi.fn(),
}));

vi.mock('@/app/api/(client)/client', () => ({
    connectMcpToAsk: mocks.connectMcpToAsk,
    getMcpServersWithStatus: mocks.getMcpServersWithStatus,
}));

vi.mock('@/components/hooks/use-toast', () => ({
    useToast: () => ({ toast: mocks.toast }),
}));

const AUTH_FAILURE = {
    serverId: 'server-1',
    serverName: 'Linear',
    toolCallId: 'tool-call-1',
};

interface HookProps {
    status: ChatStatus;
    messages: SBChatMessage[];
    isTurnInProgress: boolean;
}

const createWrapper = () => {
    const queryClient = new QueryClient();
    const Wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return Wrapper;
};

const addToolApprovalResponse = vi.fn();
const sendMessage = vi.fn();

const renderController = (initialProps: HookProps) =>
    renderHook(
        (props: HookProps) => useMcpReconnectController({
            ...props,
            addToolApprovalResponse,
            sendMessage,
            selectedSearchScopes: [],
            disabledMcpServerIds: [],
        }),
        { initialProps, wrapper: createWrapper() },
    );

const assistantMessageWithPendingApproval = (): SBChatMessage => ({
    id: 'assistant-1',
    role: 'assistant',
    parts: [
        { type: 'step-start' },
        {
            type: 'dynamic-tool',
            toolName: 'mcp_linear__save_comment',
            toolCallId: 'tool-call-2',
            state: 'approval-requested',
            input: {},
            approval: { id: 'approval-1' },
        },
    ] as SBChatMessage['parts'],
});

beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.history.pushState({}, '', '/chat/abc123');
});

afterEach(cleanup);

describe('useMcpReconnectController', () => {
    test('deduplicates repeated failures from the same connector, keeping the first tool call', () => {
        const { result } = renderController({ status: 'streaming', messages: [], isTurnInProgress: true });

        act(() => {
            result.current.onAuthRequired(AUTH_FAILURE);
            result.current.onAuthRequired({ ...AUTH_FAILURE, toolCallId: 'tool-call-9' });
        });

        const states = Object.values(result.current.contextValue.reconnectStates);
        expect(states).toHaveLength(1);
        expect(states[0]).toMatchObject({
            serverId: 'server-1',
            toolCallId: 'tool-call-1',
            status: 'authentication-required',
        });
    });

    test('automatically denies pending tool approvals exactly once', () => {
        const messages = [assistantMessageWithPendingApproval()];
        const { result, rerender } = renderController({ status: 'ready', messages, isTurnInProgress: true });

        act(() => {
            result.current.onAuthRequired(AUTH_FAILURE);
        });

        expect(addToolApprovalResponse).toHaveBeenCalledTimes(1);
        expect(addToolApprovalResponse).toHaveBeenCalledWith(expect.objectContaining({
            id: 'approval-1',
            approved: false,
        }));

        rerender({ status: 'ready', messages: [...messages], isTurnInProgress: true });
        expect(addToolApprovalResponse).toHaveBeenCalledTimes(1);
    });

    test('keeps Reconnect disabled until the interrupted response settles across stream gaps', () => {
        const { result, rerender } = renderController({ status: 'streaming', messages: [], isTurnInProgress: true });

        act(() => {
            result.current.onAuthRequired(AUTH_FAILURE);
        });
        expect(result.current.contextValue.isReconnectAllowed).toBe(false);

        // A stream can report ready between phases while the turn is still in
        // progress (e.g. waiting on the denial continuation).
        rerender({ status: 'ready', messages: [], isTurnInProgress: true });
        expect(result.current.contextValue.isReconnectAllowed).toBe(false);

        rerender({ status: 'ready', messages: [], isTurnInProgress: false });
        expect(result.current.contextValue.isReconnectAllowed).toBe(true);
    });

    test('starts the OAuth flow, saving the pending reconnect and redirecting in the current tab', async () => {
        mocks.connectMcpToAsk.mockResolvedValue({ authorizationUrl: 'https://auth.example.com/authorize' });
        const originalLocation = window.location;
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { ...originalLocation, pathname: '/chat/abc123', search: '', href: 'http://localhost/chat/abc123' },
        });

        try {
            const { result, rerender } = renderController({ status: 'streaming', messages: [], isTurnInProgress: true });
            act(() => {
                result.current.onAuthRequired(AUTH_FAILURE);
            });
            rerender({ status: 'ready', messages: [], isTurnInProgress: false });

            await act(async () => {
                result.current.contextValue.reconnect('server-1');
            });

            await waitFor(() => {
                expect(mocks.connectMcpToAsk).toHaveBeenCalledWith({ serverId: 'server-1', returnTo: '/chat/abc123' });
            });

            const stored = JSON.parse(window.sessionStorage.getItem(MCP_RECONNECT_SESSION_STORAGE_KEY) ?? '{}');
            expect(stored).toMatchObject({
                serverId: 'server-1',
                serverName: 'Linear',
                toolCallId: 'tool-call-1',
                returnTo: '/chat/abc123',
            });
            expect(window.location.href).toBe('https://auth.example.com/authorize');
            expect(result.current.contextValue.reconnectStates['server-1'].status).toBe('reconnecting');
        } finally {
            Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
        }
    });

    test('does not start the OAuth flow while the response is still settling', () => {
        const { result } = renderController({ status: 'streaming', messages: [], isTurnInProgress: true });
        act(() => {
            result.current.onAuthRequired(AUTH_FAILURE);
        });

        act(() => {
            result.current.contextValue.reconnect('server-1');
        });

        expect(mocks.connectMcpToAsk).not.toHaveBeenCalled();
    });

    test('restores the pending reconnect after the OAuth return and confirms via the status query', async () => {
        window.sessionStorage.setItem(MCP_RECONNECT_SESSION_STORAGE_KEY, JSON.stringify({
            serverId: 'server-1',
            serverName: 'Linear',
            toolCallId: 'tool-call-1',
            returnTo: '/chat/abc123',
            createdAt: Date.now(),
        }));
        mocks.getMcpServersWithStatus.mockResolvedValue([
            { id: 'server-1', name: 'Linear', isConnected: true, isAuthExpired: false },
        ]);

        const { result } = renderController({ status: 'ready', messages: [], isTurnInProgress: false });

        await waitFor(() => {
            expect(result.current.contextValue.reconnectStates['server-1']?.status).toBe('reconnected');
        });
        expect(window.sessionStorage.getItem(MCP_RECONNECT_SESSION_STORAGE_KEY)).toBeNull();
        expect(result.current.contextValue.isContinueAllowed).toBe(true);
    });

    test('falls back to authentication-required when the OAuth return did not reconnect the connector', async () => {
        window.sessionStorage.setItem(MCP_RECONNECT_SESSION_STORAGE_KEY, JSON.stringify({
            serverId: 'server-1',
            serverName: 'Linear',
            toolCallId: 'tool-call-1',
            returnTo: '/chat/abc123',
            createdAt: Date.now(),
        }));
        mocks.getMcpServersWithStatus.mockResolvedValue([
            { id: 'server-1', name: 'Linear', isConnected: false, isAuthExpired: false },
        ]);

        const { result } = renderController({ status: 'ready', messages: [], isTurnInProgress: false });

        await waitFor(() => {
            expect(result.current.contextValue.reconnectStates['server-1']?.status).toBe('authentication-required');
        });
        expect(result.current.contextValue.isContinueAllowed).toBe(false);
    });

    test('Continue sends a visible user turn naming the reconnected connector and resets the state', async () => {
        window.sessionStorage.setItem(MCP_RECONNECT_SESSION_STORAGE_KEY, JSON.stringify({
            serverId: 'server-1',
            serverName: 'Linear',
            toolCallId: 'tool-call-1',
            returnTo: '/chat/abc123',
            createdAt: Date.now(),
        }));
        mocks.getMcpServersWithStatus.mockResolvedValue([
            { id: 'server-1', name: 'Linear', isConnected: true, isAuthExpired: false },
        ]);

        const { result } = renderController({ status: 'ready', messages: [], isTurnInProgress: false });
        await waitFor(() => {
            expect(result.current.contextValue.isContinueAllowed).toBe(true);
        });

        act(() => {
            result.current.contextValue.continueAfterReconnect('server-1');
        });

        expect(sendMessage).toHaveBeenCalledTimes(1);
        const sentMessage = sendMessage.mock.calls[0][0];
        expect(sentMessage.role).toBe('user');
        expect(getUserMessageText(sentMessage as SBChatMessage)).toBe(
            'Continue the previous request now that Linear is reconnected. Do not repeat operations that already completed.'
        );
        expect(result.current.contextValue.reconnectStates).toEqual({});
    });

    test('Continue is unavailable when more than one connector failed authentication', () => {
        const { result, rerender } = renderController({ status: 'streaming', messages: [], isTurnInProgress: true });

        act(() => {
            result.current.onAuthRequired(AUTH_FAILURE);
            result.current.onAuthRequired({ serverId: 'server-2', serverName: 'Jira', toolCallId: 'tool-call-3' });
        });
        rerender({ status: 'ready', messages: [], isTurnInProgress: false });

        expect(result.current.contextValue.isContinueAllowed).toBe(false);

        act(() => {
            result.current.contextValue.continueAfterReconnect('server-1');
        });
        expect(sendMessage).not.toHaveBeenCalled();
    });
});
