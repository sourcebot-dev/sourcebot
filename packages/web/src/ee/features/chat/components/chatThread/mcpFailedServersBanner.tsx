'use client';

import { Button } from '@/components/ui/button';
import { useMcpReconnect } from '@/ee/features/chat/mcpReconnectContext';
import { AlertTriangle, Loader2, X } from 'lucide-react';

interface FailedMcpServer {
    serverId: string;
    serverName: string;
}

interface McpFailedServersBannerProps {
    servers: FailedMcpServer[];
    isVisible: boolean;
    onClose: () => void;
}

export const McpFailedServersBanner = ({ servers, isVisible, onClose }: McpFailedServersBannerProps) => {
    const reconnectContext = useMcpReconnect();

    if (!isVisible || servers.length === 0) {
        return null;
    }

    const message = servers.length === 1
        ? `Connector "${servers[0].serverName}" failed to load tools`
        : `${servers.length} connectors failed to load tools`;
    const isAnyReconnectStarting = Object.values(reconnectContext?.reconnectStates ?? {})
        .some((state) => state.status === 'reconnecting');

    return (
        <div role="alert" className="border-b border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20">
            <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-center sm:gap-6">
                <div className="flex min-w-0 items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
                    <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                        {message}
                    </span>
                </div>
                <div className="ml-6 flex items-center gap-2 self-start sm:ml-0 sm:self-auto">
                    {servers.map((server) => {
                        const reconnectState = reconnectContext?.reconnectStates[server.serverId];
                        const isReconnecting = reconnectState?.status === 'reconnecting';

                        return (
                            <Button
                                key={server.serverId}
                                size="sm"
                                disabled={!reconnectState || isAnyReconnectStarting || !reconnectContext?.isReconnectAllowed}
                                onClick={() => reconnectContext?.reconnect(server.serverId)}
                            >
                                {isReconnecting ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Reconnecting...
                                    </>
                                ) : (
                                    <>Reconnect {server.serverName}</>
                                )}
                            </Button>
                        );
                    })}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="h-6 w-6 p-0 text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-200"
                        aria-label="Dismiss failed connectors banner"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
};
