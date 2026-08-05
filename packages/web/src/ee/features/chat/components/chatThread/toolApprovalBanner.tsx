'use client';

import { Button } from "@/components/ui/button";
import { McpFavicon } from "@/ee/features/chat/mcp/components/mcpFavicon";
import { McpToolNameMap, useMcpServerIconMap, useMcpToolNameMap } from "@/ee/features/chat/mcpDisplayMetadataContext";
import { useToolApproval } from "@/ee/features/chat/toolApprovalContext";
import { SBChatToolPart } from "@/features/chat/utils";
import { cn } from "@/lib/utils";
import { getToolName } from "ai";
import { ChevronRight } from "lucide-react";
import { useCallback, useState } from "react";
import { getMcpToolDisplayParts } from "./tools/mcpToolComponent";
import { JsonHighlighter } from "./tools/jsonHighlighter";

export type ApprovalRequestedToolPart = SBChatToolPart & {
    state: 'approval-requested';
};

interface ToolApprovalBannerProps {
    parts: ApprovalRequestedToolPart[];
}

export const ToolApprovalBanner = ({ parts }: ToolApprovalBannerProps) => {
    const addToolApprovalResponse = useToolApproval();
    const iconMap = useMcpServerIconMap();
    const rawToolNames = useMcpToolNameMap();

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
                    rawToolNames={rawToolNames}
                />
            ))}
        </div>
    );
};

const ToolApprovalItem = ({
    part,
    addToolApprovalResponse,
    iconMap,
    rawToolNames,
}: {
    part: ApprovalRequestedToolPart;
    addToolApprovalResponse: ReturnType<typeof useToolApproval>;
    iconMap: Record<string, string | undefined>;
    rawToolNames: McpToolNameMap;
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const partToolName = getToolName(part);
    const display = getMcpToolDisplayParts(partToolName, rawToolNames);
    const faviconUrl = display.serverName ? iconMap[display.serverName] : undefined;

    const requestText = JSON.stringify(part.input, null, 2);

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
                        {display.serverName ? (
                            <>
                                Agent wants to use <span className="font-medium">{display.toolName}</span> from <span className="font-medium">{display.serverName}</span>
                            </>
                        ) : (
                            <>
                                Agent wants to use <span className="font-medium">{display.toolName}</span>
                            </>
                        )}
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
            {isExpanded && (
                <div className="border-t border-border px-3 py-2 max-h-72 overflow-y-auto text-xs text-muted-foreground">
                    <JsonHighlighter text={requestText} />
                </div>
            )}
        </div>
    );
};
