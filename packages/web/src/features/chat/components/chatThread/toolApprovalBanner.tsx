'use client';

import { Button } from "@/components/ui/button";
import { McpFavicon } from "@/ee/features/mcp/components/mcpFavicon";
import { useMcpServerIconMap } from "@/features/chat/mcpServerIconContext";
import { useToolApproval } from "@/features/chat/toolApprovalContext";
import { cn } from "@/lib/utils";
import { DynamicToolUIPart } from "ai";
import { ChevronRight } from "lucide-react";
import { useCallback, useState } from "react";
import { parseMcpToolName } from "./tools/mcpToolComponent";
import { JsonHighlighter } from "./tools/jsonHighlighter";

interface ToolApprovalBannerProps {
    parts: DynamicToolUIPart[];
}

export const ToolApprovalBanner = ({ parts }: ToolApprovalBannerProps) => {
    const addToolApprovalResponse = useToolApproval();
    const iconMap = useMcpServerIconMap();

    if (parts.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-col gap-2 mb-4">
            {parts.map((part) => (
                <ToolApprovalItem
                    key={part.toolCallId}
                    part={part}
                    addToolApprovalResponse={addToolApprovalResponse}
                    iconMap={iconMap}
                />
            ))}
        </div>
    );
};

const ToolApprovalItem = ({
    part,
    addToolApprovalResponse,
    iconMap,
}: {
    part: DynamicToolUIPart;
    addToolApprovalResponse: ReturnType<typeof useToolApproval>;
    iconMap: Record<string, string | undefined>;
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const parsed = parseMcpToolName(part.toolName);
    const serverName = parsed?.serverName ?? part.toolName;
    const toolName = parsed?.toolName ?? part.toolName;
    const faviconUrl = parsed ? iconMap[parsed.serverName] : undefined;

    const hasInput = part.state !== 'input-streaming';
    const requestText = hasInput ? JSON.stringify(part.input, null, 2) : '';

    const onToggle = useCallback(() => setIsExpanded(v => !v), []);

    const onApprove = useCallback(() => {
        if (part.state === 'approval-requested' && addToolApprovalResponse) {
            addToolApprovalResponse({ id: part.approval.id, approved: true });
        }
    }, [part, addToolApprovalResponse]);

    const onDeny = useCallback(() => {
        if (part.state === 'approval-requested' && addToolApprovalResponse) {
            addToolApprovalResponse({ id: part.approval.id, approved: false, reason: 'User denied' });
        }
    }, [part, addToolApprovalResponse]);

    return (
        <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center gap-3 p-3">
                <button
                    onClick={onToggle}
                    className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                >
                    <McpFavicon faviconUrl={faviconUrl} className="w-4 h-4" />
                    <span className="text-sm text-foreground truncate">
                        Agent wants to use <span className="font-medium">{toolName}</span> from <span className="font-medium">{serverName}</span>
                    </span>
                    <ChevronRight className={cn("w-3.5 h-3.5 flex-shrink-0 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
                </button>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <Button size="sm" variant="default" onClick={onApprove}>
                        Allow
                    </Button>
                    <Button size="sm" variant="ghost" onClick={onDeny}>
                        Deny
                    </Button>
                </div>
            </div>
            {hasInput && isExpanded && (
                <div className="border-t border-border px-3 py-2 max-h-72 overflow-y-auto text-xs text-muted-foreground">
                    <JsonHighlighter text={requestText} />
                </div>
            )}
        </div>
    );
};
