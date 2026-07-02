'use client';

import { CopyIconButton } from "@/app/(app)/components/copyIconButton";
import { McpFavicon } from "@/ee/features/chat/mcp/components/mcpFavicon";
import { McpToolNameMap, useMcpServerIconMap, useMcpToolNameMap } from "@/ee/features/chat/mcpServerIconContext";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { DynamicToolUIPart } from "ai";
import { CheckCircle, ChevronDown, XCircle } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { JsonHighlighter, unescapeJsonStrings } from "./jsonHighlighter";
import { ToolTokenBadge } from "./toolTokenBadge";

export function parseMcpToolName(toolName: string): { serverName: string; toolName: string } | null {
    if (!toolName.startsWith('mcp_')) {
        return null;
    }
    const withoutPrefix = toolName.slice(4);
    const doubleUnderscoreIdx = withoutPrefix.indexOf('__');
    if (doubleUnderscoreIdx === -1) {
        return null;
    }
    return {
        serverName: withoutPrefix.slice(0, doubleUnderscoreIdx),
        toolName: withoutPrefix.slice(doubleUnderscoreIdx + 2),
    };
}

export function getMcpToolDisplayParts(
    modelToolName: string,
    rawToolNames: McpToolNameMap = {},
): { serverName?: string; toolName: string; displayName: string } {
    const parsed = parseMcpToolName(modelToolName);
    const toolName = rawToolNames[modelToolName] ?? parsed?.toolName ?? modelToolName;

    return parsed
        ? {
            serverName: parsed.serverName,
            toolName,
            displayName: `${parsed.serverName}: ${toolName}`,
        }
        : {
            toolName,
            displayName: toolName,
        };
}

export const McpToolComponent = ({ part, estimatedOutputTokens }: { part: DynamicToolUIPart, estimatedOutputTokens?: number }) => {
    const needsApproval = part.state === 'approval-requested';
    const [isExpanded, setIsExpanded] = useState(needsApproval);
    const onToggle = useCallback(() => setIsExpanded(v => !v), []);

    const iconMap = useMcpServerIconMap();
    const rawToolNames = useMcpToolNameMap();
    const display = getMcpToolDisplayParts(part.toolName, rawToolNames);
    const faviconUrl = display.serverName ? iconMap[display.serverName] : undefined;

    const hasInput = part.state !== 'input-streaming';

    const requestText = useMemo(
        () => hasInput ? JSON.stringify(part.input, null, 2) : '',
        [hasInput, part.input]
    );
    const responseText = useMemo(() => {
        if (part.state === 'output-available') {
            try {
                return JSON.stringify(unescapeJsonStrings(part.output), null, 2);
            } catch {
                return String(part.output);
            }
        }
        if (part.state === 'output-error') {
            return part.errorText ?? '';
        }
        return undefined;
    }, [part.state, part.output, part.errorText]);

    const onCopyRequest = useCallback(() => {
        navigator.clipboard.writeText(requestText);
        return true;
    }, [requestText]);

    const onCopyResponse = useCallback(() => {
        if (!responseText) {
            return false;
        }
        navigator.clipboard.writeText(responseText);
        return true;
    }, [responseText]);

    const renderStatus = () => {
        if (part.state === 'output-error') {
            return (
                <span className="text-sm flex-1 text-destructive flex items-center gap-1.5">
                    <McpFavicon faviconUrl={faviconUrl} className="w-3 h-3" />
                    {display.displayName} failed: {part.errorText}
                </span>
            );
        }
        if (part.state === 'output-denied') {
            return (
                <span className="text-sm flex-1 text-muted-foreground flex items-center gap-1.5">
                    <McpFavicon faviconUrl={faviconUrl} className="w-3 h-3" />
                    <XCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                    {display.displayName} — denied
                </span>
            );
        }
        if (part.state === 'approval-requested') {
            return (
                <span className="text-sm flex-1 text-foreground flex items-center gap-1.5">
                    <McpFavicon faviconUrl={faviconUrl} className="w-3 h-3" />
                    {display.displayName}
                </span>
            );
        }
        if (part.state === 'approval-responded') {
            const approved = part.approval.approved;
            return (
                <span className="text-sm flex-1 text-muted-foreground animate-pulse flex items-center gap-1.5">
                    <McpFavicon faviconUrl={faviconUrl} className="w-3 h-3" />
                    {approved ? <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />}
                    {display.displayName}{approved ? '...' : ' — denied'}
                </span>
            );
        }
        if (part.state === 'output-available') {
            return (
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <McpFavicon faviconUrl={faviconUrl} className="w-3 h-3" />
                    {display.displayName}
                </span>
            );
        }
        // input-streaming, input-available, or other in-progress states
        return (
            <span className="text-sm flex-1 text-muted-foreground animate-pulse flex items-center gap-1.5">
                <McpFavicon faviconUrl={faviconUrl} className="w-3 h-3" />
                {display.displayName}...
            </span>
        );
    };

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                    {renderStatus()}
                </div>
                {estimatedOutputTokens !== undefined && (
                    <>
                        <ToolTokenBadge estimatedOutputTokens={estimatedOutputTokens} />
                        <Separator orientation="vertical" className="h-3 flex-shrink-0" />
                    </>
                )}
                {hasInput && (
                    <button
                        onClick={onToggle}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                    >
                        <span>Details</span>
                        <ChevronDown className={cn("h-3 w-3 transition-transform -rotate-90", isExpanded && "rotate-0")} />
                    </button>
                )}
            </div>
            {hasInput && isExpanded && (
                <div className="rounded-lg border border-border text-xs overflow-y-auto max-h-72">
                    <ResultSection label={`Request (${display.displayName})`} onCopy={onCopyRequest}>
                        <JsonHighlighter text={requestText} />
                    </ResultSection>
                    {responseText !== undefined && (
                        <>
                            <div className="border-t border-border" />
                            <ResultSection label="Response" onCopy={onCopyResponse}>
                                <div className={cn(part.state === 'output-error' && "text-destructive")}>
                                    <JsonHighlighter text={responseText} />
                                </div>
                            </ResultSection>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};


const ResultSection = ({ label, onCopy, children }: { label: string; onCopy: () => boolean; children: React.ReactNode }) => (
    <div className="flex flex-col gap-1.5">
        <div className="sticky top-0 flex items-center justify-between bg-muted px-3 py-1.5 border-b border-border">
            <span className="font-medium text-foreground">{label}</span>
            <CopyIconButton onCopy={onCopy} />
        </div>
        <div className="text-muted-foreground p-3">
            {children}
        </div>
    </div>
);
