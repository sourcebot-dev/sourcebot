'use client';

import { cn } from '@/lib/utils';
import {
    formatCount,
    formatUsageSharePercent,
    pluralize,
} from '@/features/chat/mcp/utils';
import type { McpServerToolUsageSummary, ServerToolsEntry } from '@/ee/features/chat/mcp/types';
import { BarChart3Icon, ChevronDownIcon } from 'lucide-react';

interface ConnectorToolUsageTriggerProps {
    toolUsage: McpServerToolUsageSummary;
    isOpen?: boolean;
    controlsId?: string;
    onOpenChange?: (open: boolean) => void;
}

export function ConnectorToolUsageTrigger({
    toolUsage,
    isOpen = false,
    controlsId,
    onOpenChange,
}: ConnectorToolUsageTriggerProps) {
    return (
        <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={controlsId}
            onClick={() => onOpenChange?.(!isOpen)}
            className="inline-flex items-center gap-1 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            <BarChart3Icon className="h-3 w-3" />
            {formatCount(toolUsage.totalCalls)} {pluralize(toolUsage.totalCalls, 'tool call')}
            <ChevronDownIcon className={cn("h-3 w-3 transition-transform", isOpen ? "rotate-180" : "rotate-0")} />
        </button>
    );
}

interface ConnectorToolUsageListProps {
    toolUsage: McpServerToolUsageSummary;
    toolEntry?: Extract<ServerToolsEntry, { status: 'available' }>;
    isOpen?: boolean;
    id?: string;
}

export function ConnectorToolUsageList({
    toolUsage,
    toolEntry,
    isOpen = true,
    id,
}: ConnectorToolUsageListProps) {
    if (!isOpen) {
        return null;
    }

    const topToolTotal = toolUsage.tools[0]?.totalCalls ?? 0;
    const toolByName = new Map(toolEntry?.tools.map((tool) => [tool.name, tool]) ?? []);

    return (
        <div id={id} className="mt-3 border-t pt-3">
            <p className="text-xs font-medium text-foreground">Lifetime tool usage</p>
            {toolUsage.totalCalls === 0 || toolUsage.tools.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">No tool calls yet.</p>
            ) : (
                <>
                    <div className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1">
                        {toolUsage.tools.map((tool) => {
                            const toolMetadata = toolByName.get(tool.toolName);
                            const displayName = toolMetadata?.title ?? tool.toolName;
                            const barWidth = topToolTotal > 0
                                ? Math.min(100, (tool.totalCalls / topToolTotal) * 100)
                                : 0;

                            return (
                                <div key={tool.toolName} className="space-y-1">
                                    <div className="flex min-w-0 items-center gap-2 text-xs">
                                        <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                                            {displayName}
                                        </span>
                                        <span className="shrink-0 text-muted-foreground">
                                            {formatCount(tool.totalCalls)} ({formatUsageSharePercent(tool.usageSharePercent)})
                                        </span>
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                        <div
                                            className="h-full rounded-full bg-primary"
                                            style={{
                                                width: `${barWidth}%`,
                                                minWidth: barWidth > 0 ? '2px' : undefined,
                                            }}
                                        />
                                    </div>
                                    {toolMetadata?.title && toolMetadata.title !== tool.toolName && (
                                        <p className="truncate font-mono text-[10px] text-muted-foreground">
                                            {tool.toolName}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                        {formatCount(toolUsage.totalCalls)} total tool calls across{' '}
                        {toolEntry
                            ? `${formatCount(toolUsage.usedToolCount)} of ${formatCount(toolEntry.tools.length)} ${pluralize(toolEntry.tools.length, 'tool')}`
                            : `${formatCount(toolUsage.usedToolCount)} used ${pluralize(toolUsage.usedToolCount, 'tool')}`}
                    </p>
                </>
            )}
        </div>
    );
}
