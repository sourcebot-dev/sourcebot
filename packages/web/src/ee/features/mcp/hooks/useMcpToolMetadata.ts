'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMcpServerTools } from '@/app/api/(client)/client';
import { isServiceError } from '@/lib/utils';
import { mcpQueryKeys } from '@/ee/features/mcp/queryKeys';
import type { ServerToolsEntry } from '@/ee/features/mcp/types';

const EMPTY_TOOL_ENTRIES: ServerToolsEntry[] = [];

export function useMcpToolMetadata(isOAuthAvailable: boolean, connectedServerCount: number) {
    const queryClient = useQueryClient();
    const lastAuthFailureInvalidatedAtRef = useRef(0);
    const {
        data: toolEntries = EMPTY_TOOL_ENTRIES,
        isLoading: isToolsLoading,
        isError: isToolsError,
        refetch: refetchTools,
        dataUpdatedAt: toolsDataUpdatedAt,
    } = useQuery({
        queryKey: mcpQueryKeys.tools,
        queryFn: async () => {
            const result = await getMcpServerTools();
            if (isServiceError(result)) {
                throw new Error("Failed to load connector tools");
            }
            if (!Array.isArray(result)) {
                throw new Error("Unexpected response from connector tools endpoint");
            }
            return result;
        },
        enabled: isOAuthAvailable && connectedServerCount > 0,
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const toolsByServerId = useMemo(() => {
        const map = new Map<string, ServerToolsEntry>();
        for (const entry of toolEntries) {
            map.set(entry.serverId, entry);
        }
        return map;
    }, [toolEntries]);

    useEffect(() => {
        if (toolsDataUpdatedAt === 0) {
            return;
        }
        if (lastAuthFailureInvalidatedAtRef.current === toolsDataUpdatedAt) {
            return;
        }
        if (!toolEntries.some((entry) => entry.status === 'error' && entry.reason === 'auth_failed')) {
            return;
        }

        lastAuthFailureInvalidatedAtRef.current = toolsDataUpdatedAt;
        void queryClient.invalidateQueries({ queryKey: mcpQueryKeys.serversWithStatus });
        void queryClient.invalidateQueries({ queryKey: mcpQueryKeys.configuration });
    }, [queryClient, toolEntries, toolsDataUpdatedAt]);

    return {
        toolEntries,
        toolsByServerId,
        isToolsLoading,
        isToolsError,
        refetchTools,
    };
}
