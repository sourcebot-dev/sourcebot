'use client';

import { Button } from "@/components/ui/button";
import { useAskCommands } from "@/ee/features/chat/askCommandsContext";
import { McpFavicon } from "@/ee/features/chat/mcp/components/mcpFavicon";
import { McpToolNameMap, useMcpServerIconMap, useMcpToolNameMap } from "@/ee/features/chat/mcpDisplayMetadataContext";
import { useToolApproval } from "@/ee/features/chat/toolApprovalContext";
import { ASK_COMMAND_SOURCE_PERSONAL_SKILL, ASK_COMMAND_SOURCE_SHARED_SKILL, type AskCommandDefinition } from "@/features/chat/commands/types";
import { SBChatToolPart } from "@/features/chat/utils";
import { cn } from "@/lib/utils";
import { getToolName } from "ai";
import { ChevronRight } from "lucide-react";
import { ReactNode, useCallback, useState } from "react";
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
    const askCommands = useAskCommands();

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
                    askCommands={askCommands}
                />
            ))}
        </div>
    );
};

// Per-tool approval summaries: built-in tools whose approval line should read
// as an action over the tool's input rather than the generic "wants to use
// {tool}" line. Tools without an entry fall back to the generic line.
const getBuiltinApprovalSummary = (
    part: ApprovalRequestedToolPart,
    askCommands: AskCommandDefinition[],
): ReactNode | undefined => {
    switch (part.type) {
        case 'tool-create_skill':
            return (
                <>
                    Agent wants to create skill <span className="font-medium">{part.input.name}</span>
                </>
            );
        case 'tool-update_skill': {
            const { slug, scope } = part.input;
            // Resolve the skill's display name from the chat page's command
            // catalog. Falls back to /slug when no match exists (e.g. a
            // creator-owned shared skill the user has not adopted).
            const sourceId = scope === 'shared' ? ASK_COMMAND_SOURCE_SHARED_SKILL : ASK_COMMAND_SOURCE_PERSONAL_SKILL;
            const command = askCommands.find((candidate) => candidate.sourceId === sourceId && candidate.slug === slug);
            return (
                <>
                    Agent wants to update {scope === 'shared' ? 'shared' : 'your'} skill{' '}
                    <span className="font-medium">{command?.name ?? `/${slug}`}</span>
                </>
            );
        }
        default:
            return undefined;
    }
};

const ToolApprovalItem = ({
    part,
    addToolApprovalResponse,
    iconMap,
    rawToolNames,
    askCommands,
}: {
    part: ApprovalRequestedToolPart;
    addToolApprovalResponse: ReturnType<typeof useToolApproval>;
    iconMap: Record<string, string | undefined>;
    rawToolNames: McpToolNameMap;
    askCommands: AskCommandDefinition[];
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const partToolName = getToolName(part);
    const display = getMcpToolDisplayParts(partToolName, rawToolNames);
    const faviconUrl = display.serverName ? iconMap[display.serverName] : undefined;
    const builtinSummary = getBuiltinApprovalSummary(part, askCommands);

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
                        {builtinSummary ? (
                            builtinSummary
                        ) : display.serverName ? (
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
