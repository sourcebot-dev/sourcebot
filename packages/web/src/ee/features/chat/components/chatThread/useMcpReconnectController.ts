'use client';

import { useToast } from '@/components/hooks/use-toast';
import { connectMcpToAsk, getMcpServersWithStatus } from '@/app/api/(client)/client';
import { invalidateMcpConfigurationQueries } from '@/ee/features/chat/mcp/queryKeys';
import {
    McpReconnectContextValue,
    McpReconnectState,
    McpReconnectStatus,
} from '@/ee/features/chat/mcpReconnectContext';
import { createMcpOAuthDraftPath } from '@/features/chat/mcpOAuthDraft';
import {
    clearMcpPendingReconnect,
    consumeMcpPendingReconnectForPath,
    saveMcpPendingReconnect,
} from '@/features/chat/mcpReconnect';
import { CreateUIMessage, ChatStatus, ChatAddToolApproveResponseFunction } from 'ai';
import { SBChatMessage, SearchScope } from '@/features/chat/types';
import { createUIMessage, getLastStepParts, isSBChatToolPart } from '@/features/chat/utils';
import { isServiceError } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface McpAuthRequiredData {
    serverId: string;
    serverName: string;
    toolCallId: string;
}

interface UseMcpReconnectControllerOptions {
    status: ChatStatus;
    messages: SBChatMessage[];
    isTurnInProgress: boolean;
    addToolApprovalResponse: ChatAddToolApproveResponseFunction;
    sendMessage: (message: CreateUIMessage<SBChatMessage>) => void;
    selectedSearchScopes: SearchScope[];
    disabledMcpServerIds: string[];
}

// Orchestrates the client side of MCP connector reauthentication for a chat
// thread: tracks per-connector reconnect state from transient
// `data-mcp-auth-required` events, automatically denies tool approvals still
// pending in the interrupted response, gates the Reconnect action until the
// response has settled, restores pending reconnect metadata after the OAuth
// round trip, and sends the follow-up user turn on Continue.
export function useMcpReconnectController({
    status,
    messages,
    isTurnInProgress,
    addToolApprovalResponse,
    sendMessage,
    selectedSearchScopes,
    disabledMcpServerIds,
}: UseMcpReconnectControllerOptions): {
    contextValue: McpReconnectContextValue;
    onAuthRequired: (data: McpAuthRequiredData) => void;
} {
    const [reconnectStates, setReconnectStates] = useState<Record<string, McpReconnectState>>({});
    // Response-scoped finalizing flag: set when an authentication failure is
    // reported mid-stream and cleared only once the whole assistant response
    // (including approval-denial continuations and the final tools-disabled
    // step) has settled. Covers the gaps between network streams where the
    // chat status alone reads as ready.
    const [isAuthFinalizing, setIsAuthFinalizing] = useState(false);
    const deniedApprovalIdsRef = useRef(new Set<string>());
    const hasRestoredPendingReconnect = useRef(false);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const setReconnectStatus = useCallback((serverId: string, reconnectStatus: McpReconnectStatus) => {
        setReconnectStates((prev) => {
            const existing = prev[serverId];
            if (!existing) {
                return prev;
            }
            return { ...prev, [serverId]: { ...existing, status: reconnectStatus } };
        });
    }, []);

    const onAuthRequired = useCallback((data: McpAuthRequiredData) => {
        setIsAuthFinalizing(true);
        setReconnectStates((prev) => {
            // Repeated failures from the same connector reference the first
            // failure's reconnect state (and its tool call).
            if (prev[data.serverId]) {
                return prev;
            }
            return {
                ...prev,
                [data.serverId]: {
                    serverId: data.serverId,
                    serverName: data.serverName,
                    toolCallId: data.toolCallId,
                    status: 'authentication-required',
                },
            };
        });
    }, []);

    // Automatically deny every tool approval still pending in the interrupted
    // response. Later approval actions are invalid: the parts flip to
    // approval-responded, which removes the approval UI.
    const hasAuthFailure = Object.keys(reconnectStates).length > 0;
    useEffect(() => {
        if (!hasAuthFailure) {
            return;
        }

        const latestMessage = messages.at(-1);
        if (latestMessage?.role !== 'assistant') {
            return;
        }

        const pendingApprovalParts = getLastStepParts(latestMessage.parts)
            .filter(isSBChatToolPart)
            .filter((part) => part.state === 'approval-requested');

        for (const part of pendingApprovalParts) {
            if (deniedApprovalIdsRef.current.has(part.approval.id)) {
                continue;
            }
            deniedApprovalIdsRef.current.add(part.approval.id);
            addToolApprovalResponse({
                id: part.approval.id,
                approved: false,
                reason: 'Denied automatically: a connector needs to be reconnected before more tools can run.',
            });
        }
    }, [hasAuthFailure, messages, addToolApprovalResponse]);

    // Clear the finalizing flag once the response has fully settled. A failed
    // stream also clears it so the user is not locked out of reconnecting.
    useEffect(() => {
        if (!isAuthFinalizing) {
            return;
        }
        if (status === 'error' || (status === 'ready' && !isTurnInProgress)) {
            setIsAuthFinalizing(false);
        }
    }, [isAuthFinalizing, status, isTurnInProgress]);

    // Restore pending reconnect metadata after returning from the OAuth
    // redirect, then confirm the connector actually reconnected via the
    // status endpoint. Runs once per mount; reads only sessionStorage, so it
    // does not race the OAuth status toast's query-parameter cleanup.
    useEffect(() => {
        if (hasRestoredPendingReconnect.current) {
            return;
        }
        hasRestoredPendingReconnect.current = true;

        const pending = consumeMcpPendingReconnectForPath(`${window.location.pathname}${window.location.search}`);
        if (!pending) {
            return;
        }

        setReconnectStates({
            [pending.serverId]: {
                serverId: pending.serverId,
                serverName: pending.serverName,
                toolCallId: pending.toolCallId,
                status: 'reconnecting',
            },
        });

        (async () => {
            const servers = await getMcpServersWithStatus();
            const server = isServiceError(servers)
                ? undefined
                : servers.find((candidate) => candidate.id === pending.serverId);

            if (server?.isConnected && !server.isAuthExpired) {
                setReconnectStatus(pending.serverId, 'reconnected');
            } else {
                setReconnectStatus(pending.serverId, 'authentication-required');
                toast({
                    description: `${pending.serverName} was not reconnected.`,
                    variant: 'destructive',
                });
            }
        })();
    }, [setReconnectStatus, toast]);

    const isReconnectAllowed = !isTurnInProgress && !isAuthFinalizing;
    const isReconnectAllowedRef = useRef(isReconnectAllowed);
    useEffect(() => {
        isReconnectAllowedRef.current = isReconnectAllowed;
    }, [isReconnectAllowed]);

    const reconnectStatesRef = useRef(reconnectStates);
    useEffect(() => {
        reconnectStatesRef.current = reconnectStates;
    }, [reconnectStates]);

    const reconnect = useCallback(async (serverId: string) => {
        const state = reconnectStatesRef.current[serverId];
        if (!state || state.status === 'reconnecting' || !isReconnectAllowedRef.current) {
            return;
        }

        const returnTo = createMcpOAuthDraftPath(window.location.pathname, window.location.search);
        if (!returnTo) {
            toast({
                description: 'Failed to start the reconnect flow for this page.',
                variant: 'destructive',
            });
            return;
        }

        setReconnectStatus(serverId, 'reconnecting');
        saveMcpPendingReconnect({
            serverId,
            serverName: state.serverName,
            toolCallId: state.toolCallId,
            returnTo,
        });

        const result = await connectMcpToAsk({ serverId, returnTo });

        if (isServiceError(result)) {
            clearMcpPendingReconnect();
            setReconnectStatus(serverId, 'authentication-required');
            toast({
                description: `Failed to reconnect ${state.serverName}. ${result.message}`,
                variant: 'destructive',
            });
            return;
        }

        if (result.authorizationUrl) {
            window.location.href = result.authorizationUrl;
            return;
        }

        // No authorization URL: the stored credentials are still considered
        // authorized (e.g. a refresh succeeded out of band). Confirm via the
        // status endpoint; if the connector still is not usable, this is the
        // known V1-unsupported corner case and the user can retry.
        clearMcpPendingReconnect();
        await invalidateMcpConfigurationQueries(queryClient);
        const servers = await getMcpServersWithStatus();
        const server = isServiceError(servers)
            ? undefined
            : servers.find((candidate) => candidate.id === serverId);

        if (server?.isConnected && !server.isAuthExpired) {
            setReconnectStatus(serverId, 'reconnected');
        } else {
            setReconnectStatus(serverId, 'authentication-required');
            toast({
                description: `${state.serverName} was not reconnected.`,
                variant: 'destructive',
            });
        }
    }, [queryClient, setReconnectStatus, toast]);

    const stateList = useMemo(() => Object.values(reconnectStates), [reconnectStates]);
    // Continue is only supported when exactly one connector failed
    // authentication in the response, and it has been reconnected.
    const isContinueAllowed =
        isReconnectAllowed &&
        stateList.length === 1 &&
        stateList[0].status === 'reconnected';
    const isContinueAllowedRef = useRef(isContinueAllowed);
    useEffect(() => {
        isContinueAllowedRef.current = isContinueAllowed;
    }, [isContinueAllowed]);

    const continueAfterReconnect = useCallback((serverId: string) => {
        const state = reconnectStatesRef.current[serverId];
        if (!state || state.status !== 'reconnected' || !isContinueAllowedRef.current) {
            return;
        }

        sendMessage(createUIMessage(
            `Continue the previous request now that ${state.serverName} is reconnected. Do not repeat operations that already completed.`,
            [],
            selectedSearchScopes,
            disabledMcpServerIds,
        ));

        setReconnectStates({});
        deniedApprovalIdsRef.current.clear();
    }, [sendMessage, selectedSearchScopes, disabledMcpServerIds]);

    const contextValue = useMemo<McpReconnectContextValue>(() => ({
        reconnectStates,
        isReconnectAllowed,
        isContinueAllowed,
        reconnect,
        continueAfterReconnect,
    }), [reconnectStates, isReconnectAllowed, isContinueAllowed, reconnect, continueAfterReconnect]);

    return { contextValue, onAuthRequired };
}
