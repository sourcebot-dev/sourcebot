import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
    McpReconnectContext,
    McpReconnectContextValue,
    McpReconnectState,
} from '@/ee/features/chat/mcpReconnectContext';
import { McpReconnectBanner } from './mcpReconnectBanner';

afterEach(cleanup);

const createReconnectState = (overrides: Partial<McpReconnectState> = {}): McpReconnectState => ({
    serverId: 'server-1',
    serverName: 'Linear',
    toolCallId: 'tool-call-1',
    status: 'authentication-required',
    ...overrides,
});

const createReconnectContext = (
    state: McpReconnectState,
    overrides: Partial<McpReconnectContextValue> = {},
): McpReconnectContextValue => ({
    reconnectStates: { [state.serverId]: state },
    isReconnectAllowed: true,
    isContinueAllowed: false,
    reconnect: vi.fn(),
    continueAfterReconnect: vi.fn(),
    ...overrides,
});

const renderBanner = (contextValue: McpReconnectContextValue) => render(
    <McpReconnectContext.Provider value={contextValue}>
        <McpReconnectBanner />
    </McpReconnectContext.Provider>
);

describe('McpReconnectBanner', () => {
    test('warns about the authentication failure and exposes the reconnect action', () => {
        const contextValue = createReconnectContext(createReconnectState());
        renderBanner(contextValue);

        expect(screen.getByRole('alert')).toBeTruthy();
        expect(screen.getByText('Linear authentication failed')).toBeTruthy();
        expect(screen.getByText('Reconnect Linear to continue using its tools.')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Reconnect Linear' }));
        expect(contextValue.reconnect).toHaveBeenCalledWith('server-1');
    });

    test('keeps reconnect disabled until the assistant response settles', () => {
        const contextValue = createReconnectContext(
            createReconnectState(),
            { isReconnectAllowed: false },
        );
        renderBanner(contextValue);

        const button = screen.getByRole('button', { name: 'Reconnect Linear' }) as HTMLButtonElement;
        expect(button.disabled).toBe(true);
    });

    test('shows progress while the reconnect flow starts', () => {
        const contextValue = createReconnectContext(createReconnectState({ status: 'reconnecting' }));
        renderBanner(contextValue);

        const button = screen.getByRole('button', { name: /Reconnecting/ }) as HTMLButtonElement;
        expect(button.disabled).toBe(true);
    });

    test('shows the continue action after reconnecting', () => {
        const contextValue = createReconnectContext(
            createReconnectState({ status: 'reconnected' }),
            { isContinueAllowed: true },
        );
        renderBanner(contextValue);

        expect(screen.getByRole('status')).toBeTruthy();
        expect(screen.getByText('Linear reconnected')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        expect(contextValue.continueAfterReconnect).toHaveBeenCalledWith('server-1');
    });

    test('does not offer Continue when automatic continuation is unavailable', () => {
        const contextValue = createReconnectContext(createReconnectState({ status: 'reconnected' }));
        renderBanner(contextValue);

        expect(screen.getByText('Connection restored.')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    });

    test('does not render without a reconnect failure', () => {
        const contextValue: McpReconnectContextValue = {
            reconnectStates: {},
            isReconnectAllowed: true,
            isContinueAllowed: false,
            reconnect: vi.fn(),
            continueAfterReconnect: vi.fn(),
        };
        const { container } = renderBanner(contextValue);

        expect(container.childElementCount).toBe(0);
    });
});
