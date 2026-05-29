import { describe, expect, test, vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import { invalidateMcpConfigurationQueries, mcpQueryKeys } from './queryKeys';

describe('invalidateMcpConfigurationQueries', () => {
    test('invalidates admin configuration, account MCP server status, and tool metadata', async () => {
        const queryClient = {
            invalidateQueries: vi.fn().mockResolvedValue(undefined),
        } as unknown as QueryClient;

        await invalidateMcpConfigurationQueries(queryClient);

        expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: mcpQueryKeys.configuration });
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: mcpQueryKeys.serversWithStatus });
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: mcpQueryKeys.tools });
    });
});
