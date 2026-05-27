'use client';

import { useState, type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible } from '@/components/ui/collapsible';
import { ConnectorRowInfo } from '@/ee/features/mcp/components/connectorRowInfo';
import { ConnectorToolList, ConnectorToolTrigger } from '@/ee/features/mcp/components/connectorToolDisclosure';
import type { ServerToolsEntry } from '@/ee/features/mcp/types';

interface ConnectorCardProps {
    faviconUrl: string | undefined;
    name: string;
    serverUrl: string;

    isConnected: boolean;
    isAuthExpired?: boolean;
    isOAuthAvailable?: boolean;
    isStatusUnavailable?: boolean;
    toolEntry?: ServerToolsEntry;
    isToolsLoading?: boolean;
    isToolsError?: boolean;
    onRetryTools?: () => void;

    statusBadge: ReactNode;
    actionButtons: ReactNode;
}

export function ConnectorCard({
    faviconUrl,
    name,
    serverUrl,
    isConnected,
    isAuthExpired,
    isOAuthAvailable,
    isStatusUnavailable,
    toolEntry,
    isToolsLoading = false,
    isToolsError = false,
    onRetryTools,
    statusBadge,
    actionButtons,
}: ConnectorCardProps) {
    const [isToolListOpen, setIsToolListOpen] = useState(false);
    const availableToolEntry = toolEntry?.status === 'available' ? toolEntry : undefined;
    const hasToolList = !!availableToolEntry;
    const isLoadingToolsForServer = isConnected && !availableToolEntry && isToolsLoading;

    return (
        <Collapsible
            open={hasToolList && isToolListOpen}
            onOpenChange={(open) => setIsToolListOpen(hasToolList ? open : false)}
        >
            <Card>
                <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                        <ConnectorRowInfo
                            faviconUrl={faviconUrl}
                            name={name}
                            serverUrl={serverUrl}
                            size="sm"
                        >
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                                {statusBadge}
                                <ConnectorToolTrigger
                                    isConnected={isConnected}
                                    isAuthExpired={isAuthExpired}
                                    isOAuthAvailable={isOAuthAvailable}
                                    isStatusUnavailable={isStatusUnavailable}
                                    toolEntry={availableToolEntry}
                                    isLoading={isLoadingToolsForServer}
                                    isToolsQueryError={isConnected && isToolsError}
                                    isOpen={isToolListOpen}
                                    onRetry={onRetryTools}
                                />
                            </div>
                        </ConnectorRowInfo>
                        <div className="flex shrink-0 items-center gap-1.5">
                            {actionButtons}
                        </div>
                    </div>
                    <ConnectorToolList toolEntry={availableToolEntry} />
                </CardContent>
            </Card>
        </Collapsible>
    );
}
