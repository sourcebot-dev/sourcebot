'use client';

import { useState } from 'react';
import { LoadingButton } from '@/components/ui/loading-button';
import { useToast } from '@/components/hooks/use-toast';
import { isServiceError } from '@/lib/utils';
import { connectMcpToAsk } from '@/app/api/(client)/client';
import { ExternalLink } from 'lucide-react';

interface ConnectMcpButtonProps {
    serverId: string;
    isConnected?: boolean;
    isAuthExpired?: boolean;
}

export function ConnectMcpButton({ serverId, isConnected, isAuthExpired }: ConnectMcpButtonProps) {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const buttonLabel = isConnected || isAuthExpired ? "Reconnect" : "Connect MCP Server";
    const buttonVariant = isConnected ? "outline" as const : undefined;

    const handleConnect = async () => {
        setLoading(true);
        const result = await connectMcpToAsk({ serverId });

        if (isServiceError(result)) {
            toast({
                description: `Failed to connect MCP server. ${result.message}`,
            });
            setLoading(false);
            return;
        }

        if (result.authorizationUrl) {
            // OAuth flow — redirect to the authorization URL
            window.location.href = result.authorizationUrl;
            // Keep loading=true while redirecting (same pattern as ManageSubscriptionButton)
        } else {
            // Already authorized
            toast({
                description: 'MCP server is already connected.',
            });
            setLoading(false);
        }
    };

    return (
        <LoadingButton
            onClick={handleConnect}
            loading={loading}
            variant={buttonVariant}
        >
            {buttonLabel}
            <ExternalLink className="ml-2 h-4 w-4" />
        </LoadingButton>
    );
}