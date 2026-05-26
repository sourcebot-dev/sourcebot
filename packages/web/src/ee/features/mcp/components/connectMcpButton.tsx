'use client';

import { LoadingButton } from '@/components/ui/loading-button';
import { ExternalLink, PlusIcon } from 'lucide-react';
import type { ButtonProps } from '@/components/ui/button';
import { useConnectMcp } from '@/ee/features/mcp/hooks/useConnectMcp';

interface ConnectMcpButtonProps {
    serverId: string;
    isConnected?: boolean;
    isAuthExpired?: boolean;
    size?: ButtonProps['size'];
}

export function ConnectMcpButton({ serverId, isConnected, isAuthExpired, size }: ConnectMcpButtonProps) {
    const { connect, loadingServerId } = useConnectMcp();
    const loading = loadingServerId === serverId;

    const isSuggested = !isConnected && !isAuthExpired;
    const buttonLabel = isSuggested ? "Connect" : "Reconnect";
    const buttonVariant = isConnected ? "outline" as const : undefined;

    return (
        <LoadingButton
            onClick={() => connect(serverId)}
            loading={loading}
            variant={buttonVariant}
            size={size}
        >
            {isSuggested && <PlusIcon className="mr-1.5 h-3.5 w-3.5" />}
            {buttonLabel}
            {!isSuggested && <ExternalLink className="ml-1.5 h-3.5 w-3.5" />}
        </LoadingButton>
    );
}
