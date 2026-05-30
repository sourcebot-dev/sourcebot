'use client';

import { useId, useState, type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ConnectorRowInfo } from '@/ee/features/chat/mcp/components/connectorRowInfo';
import { ConnectorToolList, ConnectorToolTrigger } from '@/ee/features/chat/mcp/components/connectorToolDisclosure';
import { ConnectorToolUsageList, ConnectorToolUsageTrigger } from '@/ee/features/chat/mcp/components/connectorToolUsageDisclosure';
import type { McpServerToolUsageSummary, ServerToolsEntry } from '@/ee/features/chat/mcp/types';

interface ConnectorCardProps {
    faviconUrl: string | undefined;
    name: string;
    serverUrl: string;

    isConnected: boolean;
    isAuthExpired?: boolean;
    isOAuthAvailable?: boolean;
    isStatusUnavailable?: boolean;
    toolEntry?: ServerToolsEntry;
    toolUsage?: McpServerToolUsageSummary;
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
    toolUsage,
    isToolsLoading = false,
    isToolsError = false,
    onRetryTools,
    statusBadge,
    actionButtons,
}: ConnectorCardProps) {
    const [openPanel, setOpenPanel] = useState<'tools' | 'usage' | null>(null);
    const panelIdPrefix = useId();
    const toolsPanelId = `${panelIdPrefix}-tools`;
    const usagePanelId = `${panelIdPrefix}-usage`;
    const availableToolEntry = toolEntry?.status === 'available' ? toolEntry : undefined;
    const hasToolList = !!availableToolEntry;
    const hasToolUsage = (toolUsage?.totalCalls ?? 0) > 0;
    const isToolListOpen = openPanel === 'tools';
    const isToolUsageOpen = hasToolUsage && openPanel === 'usage';
    const isLoadingToolsForServer = isConnected && !availableToolEntry && isToolsLoading;

    return (
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
                                controlsId={toolsPanelId}
                                onOpenChange={(open) => setOpenPanel(open && hasToolList ? 'tools' : null)}
                                onRetry={onRetryTools}
                            />
                            {hasToolUsage && toolUsage && (
                                <ConnectorToolUsageTrigger
                                    toolUsage={toolUsage}
                                    isOpen={isToolUsageOpen}
                                    controlsId={usagePanelId}
                                    onOpenChange={(open) => setOpenPanel(open ? 'usage' : null)}
                                />
                            )}
                        </div>
                    </ConnectorRowInfo>
                    <div className="flex shrink-0 items-center gap-1.5">
                        {actionButtons}
                    </div>
                </div>
                <ConnectorToolList toolEntry={availableToolEntry} isOpen={isToolListOpen} id={toolsPanelId} />
                {hasToolUsage && toolUsage && (
                    <ConnectorToolUsageList
                        toolUsage={toolUsage}
                        toolEntry={availableToolEntry}
                        isOpen={isToolUsageOpen}
                        id={usagePanelId}
                    />
                )}
            </CardContent>
        </Card>
    );
}
