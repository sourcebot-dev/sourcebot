'use client';

import { createContext, useContext } from 'react';

export type McpReconnectStatus = 'authentication-required' | 'reconnecting' | 'reconnected';

// Client-only reconnect state for a connector that failed authentication in
// the current assistant response. `toolCallId` identifies the first failed
// tool call so its technical status can be decorated while the recovery
// action remains visible in the thread-level banner. This state intentionally
// does not survive an unrelated reload.
export interface McpReconnectState {
    serverId: string;
    serverName: string;
    toolCallId: string;
    status: McpReconnectStatus;
}

export interface McpReconnectContextValue {
    // Keyed by connector (server) ID.
    reconnectStates: Record<string, McpReconnectState>;
    // False until the interrupted assistant response has fully settled
    // (started tool calls finished, pending approvals denied, the final
    // tools-disabled step streamed and persisted).
    isReconnectAllowed: boolean;
    // True only in the supported case: exactly one failed connector, and it
    // has been reconnected.
    isContinueAllowed: boolean;
    reconnect: (serverId: string) => void;
    continueAfterReconnect: (serverId: string) => void;
}

export const McpReconnectContext = createContext<McpReconnectContextValue | undefined>(undefined);

export const useMcpReconnect = () => useContext(McpReconnectContext);

export const getMcpReconnectStateForToolCall = (
    reconnectStates: Record<string, McpReconnectState>,
    toolCallId: string,
): McpReconnectState | undefined => {
    return Object.values(reconnectStates).find((state) => state.toolCallId === toolCallId);
};
