'use client';

import { Button } from '@/components/ui/button';
import { useMcpReconnect } from '@/ee/features/chat/mcpReconnectContext';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

export const McpReconnectBanner = () => {
    const reconnectContext = useMcpReconnect();
    const reconnectStates = Object.values(reconnectContext?.reconnectStates ?? {})
        .filter((state) => state.source !== 'tool-load');

    if (!reconnectContext || reconnectStates.length === 0) {
        return null;
    }

    return (
        <div>
            {reconnectStates.map((state) => {
                if (state.status === 'reconnected') {
                    return (
                        <div
                            key={state.serverId}
                            role="status"
                            className="border-b border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20"
                        >
                            <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-center sm:gap-6">
                                <div className="flex min-w-0 items-start gap-2">
                                    <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400" />
                                    <div>
                                        <p className="text-sm font-medium text-green-800 dark:text-green-200">
                                            {state.serverName} reconnected
                                        </p>
                                        <p className="text-sm text-green-700 dark:text-green-300">
                                            {reconnectContext.isContinueAllowed
                                                ? 'Continue to retry your request.'
                                                : 'Connection restored.'}
                                        </p>
                                    </div>
                                </div>
                                {reconnectContext.isContinueAllowed && (
                                    <Button
                                        size="sm"
                                        className="ml-6 self-start sm:ml-0 sm:self-auto"
                                        onClick={() => reconnectContext.continueAfterReconnect(state.serverId)}
                                    >
                                        Continue
                                    </Button>
                                )}
                            </div>
                        </div>
                    );
                }

                const isReconnecting = state.status === 'reconnecting';
                return (
                    <div
                        key={state.serverId}
                        role="alert"
                        className="border-b border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
                    >
                        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-center sm:gap-6">
                            <div className="flex min-w-0 items-start gap-2">
                                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400" />
                                <div>
                                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                        {state.serverName} authentication failed
                                    </p>
                                    <p className="text-sm text-red-700 dark:text-red-300">
                                        Reconnect {state.serverName} to continue using its tools.
                                    </p>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                className="ml-6 self-start sm:ml-0 sm:self-auto"
                                disabled={isReconnecting || !reconnectContext.isReconnectAllowed}
                                onClick={() => reconnectContext.reconnect(state.serverId)}
                            >
                                {isReconnecting ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Reconnecting...
                                    </>
                                ) : (
                                    <>Reconnect {state.serverName}</>
                                )}
                            </Button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
