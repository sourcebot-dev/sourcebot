'use client';

import { ReasoningUIPart as ReasoningUIPartType } from 'ai';
import { ToolHeader } from './tools/shared';
import { MarkdownUIPart } from './markdownUIPart';
import { Brain, Loader2 } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';

interface ReasoningUIPartProps {
    part: ReasoningUIPartType;
    isStreaming: boolean;
    isActive: boolean;
    duration?: number;
}

export const ReasoningUIPart = ({ part, isStreaming, isActive, duration }: ReasoningUIPartProps) => {
    const [isExpanded, setIsExpanded] = useState(true);

    useEffect(() => {
        setIsExpanded(isActive);
    }, [isActive]);

    const label = useMemo(() => {
        if (isActive) {
            return "Thinking...";
        }

        if (duration) {
            const seconds = Math.round(duration / 1000) || 1;
            return `Thought for ${seconds} second${seconds !== 1 ? 's' : ''}`;
        }

        return 'Thought for unknown duration';
    }, [isActive, duration]);

    return (
        <>
            <ToolHeader
                isLoading={isActive}
                isError={false}
                isExpanded={isExpanded}
                label={label}
                Icon={isActive ? Loader2 : Brain}
                onExpand={setIsExpanded}
            />
            {isExpanded && (
                <MarkdownUIPart
                    content={part.text}
                    isStreaming={isStreaming}
                    className="text-sm prose-p:text-muted-foreground prose-li:text-muted-foreground prose-li:marker:text-muted-foreground"
                />
            )}
        </>
    )
};