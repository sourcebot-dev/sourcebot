'use client';

import { useState } from 'react';
import { useToast } from '@/components/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { connectMcpToAsk } from '@/app/api/(client)/client';
import { invalidateMcpConfigurationQueries } from '@/ee/features/mcp/queryKeys';
import { isServiceError } from '@/lib/utils';

export function useConnectMcp() {
    const [loadingServerId, setLoadingServerId] = useState<string | null>(null);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const connect = async (serverId: string) => {
        setLoadingServerId(serverId);
        const result = await connectMcpToAsk({ serverId });

        if (isServiceError(result)) {
            toast({
                description: `Failed to connect connector. ${result.message}`,
            });
            setLoadingServerId(null);
            return;
        }

        if (result.authorizationUrl) {
            window.location.href = result.authorizationUrl;
        } else {
            toast({
                description: 'Connector is already connected.',
            });
            await invalidateMcpConfigurationQueries(queryClient);
            setLoadingServerId(null);
        }
    };

    return { connect, loadingServerId };
}
