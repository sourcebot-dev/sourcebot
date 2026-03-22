'use client';

import { SBChatMessageToolTypes } from "@/features/chat/types";
import { CopyIconButton } from "@/app/[domain]/components/copyIconButton";
import { ToolUIPart } from "ai";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCallback, useState } from "react";

export const ToolOutputGuard = <T extends ToolUIPart<{ [K in keyof SBChatMessageToolTypes]: SBChatMessageToolTypes[K] }>>({
    part,
    loadingText,
    children,
}: {
    part: T,
    loadingText: string,
    children: (output: Extract<T, { state: 'output-available' }>['output']) => React.ReactNode,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const onToggle = useCallback(() => setIsExpanded(v => !v), []);

    const hasInput = part.state !== 'input-streaming';

    const requestText = hasInput ? JSON.stringify(part.input, null, 2) : '';
    const responseText = part.state === 'output-available'
        ? (() => {
            const raw = (part.output as { output: string }).output;
            try {
                return JSON.stringify(JSON.parse(raw), null, 2);
            } catch {
                return raw;
            }
        })()
        : part.state === 'output-error'
        ? (part.errorText ?? '')
        : undefined;

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

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                    {part.state === 'output-error' ? (
                        <span className="text-sm flex-1 text-destructive">
                            {part.title!} failed with error: {part.errorText}
                        </span>
                    ) : part.state !== 'output-available' ? (
                        <span className="text-sm flex-1 text-muted-foreground animate-pulse">
                            {loadingText}
                        </span>
                    ) : (
                        children(part.output as Extract<T, { state: 'output-available' }>['output'])
                    )}
                </div>
                {hasInput && <ExpandButton isExpanded={isExpanded} onToggle={onToggle} />}
            </div>
            {hasInput && isExpanded && (
                <div className="rounded-lg border border-border text-xs overflow-y-auto max-h-72">
                    <ResultSection label="Request" onCopy={onCopyRequest}>
                        <pre className="whitespace-pre-wrap break-all font-mono">
                            {requestText}
                        </pre>
                    </ResultSection>
                    {responseText !== undefined && (
                        <>
                            <div className="border-t border-border" />
                            <ResultSection label="Response" onCopy={onCopyResponse}>
                                <pre className={cn("whitespace-pre-wrap break-all font-mono", part.state === 'output-error' && "text-destructive")}>
                                    {responseText}
                                </pre>
                            </ResultSection>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

const ExpandButton = ({ isExpanded, onToggle }: { isExpanded: boolean; onToggle: () => void }) => (
    <button onClick={onToggle} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
        <span>Details</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform -rotate-90", isExpanded && "rotate-0")} />
    </button>
);

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
