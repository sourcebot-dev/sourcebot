import type { QueryClient } from '@tanstack/react-query';

export const mcpQueryKeys = {
    serversWithStatus: ['mcpServersWithStatus'] as const,
    configuration: ['mcpConfiguration'] as const,
    tools: ['mcpTools'] as const,
};

export async function invalidateMcpConfigurationQueries(queryClient: QueryClient) {
    await Promise.all([
        queryClient.invalidateQueries({ queryKey: mcpQueryKeys.configuration }),
        queryClient.invalidateQueries({ queryKey: mcpQueryKeys.serversWithStatus }),
        queryClient.invalidateQueries({ queryKey: mcpQueryKeys.tools }),
    ]);
}
