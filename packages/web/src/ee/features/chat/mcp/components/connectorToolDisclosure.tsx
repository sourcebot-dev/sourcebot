'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { pluralize } from '@/features/chat/mcp/utils';
import type { ServerToolsEntry, ToolMetadataErrorReason, ToolSummary } from '@/ee/features/chat/mcp/types';
import { BanIcon, ChevronDownIcon, CircleCheckIcon, HandIcon, RefreshCwIcon, WrenchIcon } from 'lucide-react';

function getErrorLabel(reason: ToolMetadataErrorReason) {
    switch (reason) {
        case 'timeout':
            return 'Tools timed out';
        case 'auth_failed':
            return 'Reconnect to see tools';
        case 'unsupported':
            return 'Tools unsupported';
        case 'connection_failed':
        case 'unknown':
            return 'Tools unavailable';
    }
}

function getToolCountLabel(entry: Extract<ServerToolsEntry, { status: 'available' }>) {
    const countLabel = `${entry.tools.length}${entry.truncated ? '+' : ''}`;
    const nounCount = entry.truncated ? 2 : entry.tools.length;
    return `${countLabel} ${pluralize(nounCount, 'tool')}`;
}

interface ConnectorToolTriggerProps {
    isConnected: boolean;
    isAuthExpired?: boolean;
    isAskAgentAvailable?: boolean;
    isStatusUnavailable?: boolean;
    toolEntry?: ServerToolsEntry;
    isLoading?: boolean;
    isToolsQueryError?: boolean;
    isOpen?: boolean;
    controlsId?: string;
    onOpenChange?: (open: boolean) => void;
    onRetry?: () => void;
}

export function ConnectorToolTrigger({
    isConnected,
    isAuthExpired = false,
    isAskAgentAvailable = true,
    isStatusUnavailable = false,
    toolEntry,
    isLoading = false,
    isToolsQueryError = false,
    isOpen = false,
    controlsId,
    onOpenChange,
    onRetry,
}: ConnectorToolTriggerProps) {
    const availableEntry = toolEntry?.status === 'available' ? toolEntry : undefined;
    const errorEntry = toolEntry?.status === 'error' ? toolEntry : undefined;
    const canExpand = !!availableEntry;

    if (canExpand) {
        return (
            <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={controlsId}
                onClick={() => onOpenChange?.(!isOpen)}
                className="inline-flex items-center gap-1 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <WrenchIcon className="h-3 w-3" />
                {getToolCountLabel(availableEntry)}
                <ChevronDownIcon className={cn("h-3 w-3 transition-transform", isOpen ? "rotate-180" : "rotate-0")} />
            </button>
        );
    }

    let label = 'Tools unavailable';
    let canRetry = false;

    if (!isAskAgentAvailable || isStatusUnavailable) {
        label = 'Tools unavailable';
    } else if (!isConnected && isAuthExpired) {
        label = 'Reconnect to see tools';
    } else if (!isConnected) {
        label = 'Connect to see tools';
    } else if (isLoading) {
        label = 'Loading tools...';
    } else if (errorEntry) {
        label = getErrorLabel(errorEntry.reason);
        canRetry = true;
    } else if (isToolsQueryError) {
        label = 'Tools unavailable';
        canRetry = true;
    }

    return (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
            <WrenchIcon className="h-3 w-3" />
            {label}
            {canRetry && onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    className="ml-1 inline-flex items-center gap-0.5 rounded-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                    <RefreshCwIcon className="h-3 w-3" />
                    Retry
                </button>
            )}
        </span>
    );
}

function ToolHintBadges({ tool }: { tool: ToolSummary }) {
    const annotations = tool.annotations;
    if (!annotations) {
        return null;
    }

    return (
        <>
            {annotations.readOnlyHint === true && (
                <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-medium text-muted-foreground">
                    Read-only
                </Badge>
            )}
            {annotations.destructiveHint === true && (
                <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-medium text-destructive">
                    Destructive
                </Badge>
            )}
            {annotations.idempotentHint === true && (
                <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-medium text-muted-foreground">
                    Idempotent
                </Badge>
            )}
        </>
    );
}

function getToolPermissionLabel(permission: ToolSummary['permission']) {
    switch (permission) {
        case 'ALLOWED':
            return 'Allowed';
        case 'NEEDS_APPROVAL':
            return 'Needs Approval';
        case 'DISABLED':
            return 'Blocked';
        default:
            return undefined;
    }
}

function ToolPermissionBadge({ permission }: { permission?: ToolSummary['permission'] }) {
    const label = getToolPermissionLabel(permission);
    if (!permission || !label) {
        return null;
    }

    const Icon = permission === 'ALLOWED'
        ? CircleCheckIcon
        : permission === 'NEEDS_APPROVAL'
            ? HandIcon
            : BanIcon;

    return (
        <Badge
            variant="outline"
            className={cn(
                "px-1.5 py-0 text-[10px] font-medium transition-none",
                permission === 'ALLOWED' && "text-green-500",
                permission === 'NEEDS_APPROVAL' && "text-primary",
                permission === 'DISABLED' && "text-destructive",
            )}
        >
            <Icon className="mr-1 h-3 w-3" />
            {label}
        </Badge>
    );
}

function ToolDetail({ tool }: { tool: ToolSummary }) {
    const displayName = tool.title ?? tool.name;

    return (
        <div className="rounded-md border bg-muted/30 p-2">
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="break-all text-xs font-medium text-foreground">{displayName}</span>
                {tool.title && tool.title !== tool.name && (
                    <span className="break-all font-mono text-[10px] text-muted-foreground">{tool.name}</span>
                )}
                <ToolPermissionBadge permission={tool.permission} />
                <ToolHintBadges tool={tool} />
            </div>
            {tool.description && (
                <p className="mt-1 break-words text-xs text-muted-foreground">{tool.description}</p>
            )}
        </div>
    );
}

interface ConnectorToolListProps {
    toolEntry?: ServerToolsEntry;
    isOpen?: boolean;
    id?: string;
}

export function ConnectorToolList({ toolEntry, isOpen = true, id }: ConnectorToolListProps) {
    const [selectedTool, setSelectedTool] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setSelectedTool(null);
        }
    }, [isOpen]);

    if (!isOpen || toolEntry?.status !== 'available') {
        return null;
    }

    const activeTool = toolEntry.tools.find((t) => t.name === selectedTool);

    return (
        <div id={id} className="mt-3 border-t pt-3">
            {toolEntry.tools.length === 0 ? (
                <p className="text-xs text-muted-foreground">No tools exposed by this connector.</p>
            ) : (
                <div className="space-y-2">
                    <div className="flex max-h-48 flex-wrap gap-1 overflow-y-auto pr-1">
                        {toolEntry.tools.map((tool) => {
                            const displayName = tool.title ?? tool.name;
                            const isSelected = selectedTool === tool.name;

                            return (
                                <button
                                    key={tool.name}
                                    type="button"
                                    onClick={() => setSelectedTool(isSelected ? null : tool.name)}
                                    className={cn(
                                        "rounded-md border border-border px-2 py-0.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                        isSelected
                                            ? "bg-accent text-foreground"
                                            : "bg-muted/30 text-muted-foreground hover:bg-accent hover:text-foreground"
                                    )}
                                >
                                    {displayName}
                                </button>
                            );
                        })}
                    </div>
                    {activeTool && (
                        <ToolDetail tool={activeTool} />
                    )}
                </div>
            )}
        </div>
    );
}
