'use client';

import { ReasoningUIPart as ReasoningUIPartType } from '@ai-sdk/ui-utils';
import { ToolHeader } from './toolUIPart/shared';
import { MarkdownUIPart } from './markdownUIPart';
import { Brain, Loader2 } from 'lucide-react';
import { useEffect, useState, useRef, useMemo } from 'react';

interface ReasoningUIPartProps {
    part: ReasoningUIPartType;
    isStreaming: boolean;
    isActive: boolean;
}

export const ReasoningUIPart = ({ part, isStreaming, isActive }: ReasoningUIPartProps) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [elapsedTime, setElapsedTime] = useState(0);
    const startTimeRef = useRef<number>(Date.now());
    const isFinishedRef = useRef(false);

    useEffect(() => {
        setIsExpanded(isActive);

        if (!isActive && !isFinishedRef.current) {
            isFinishedRef.current = true;
            setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000) || 0);
        }
    }, [isActive]);

    const label = useMemo(() => {
        if (isActive) {
            return "Thinking...";
        } else {
            return `Thought for ${elapsedTime} second${elapsedTime !== 1 ? 's' : ''}`;
        }
    }, [isActive, elapsedTime]);

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
                    content={part.reasoning}
                    isStreaming={isStreaming}
                    className="text-sm prose-p:text-muted-foreground prose-li:text-muted-foreground prose-li:marker:text-muted-foreground"
                />
            )}
        </>
    )
};