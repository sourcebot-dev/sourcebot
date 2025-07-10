'use client';

import { forwardRef, useMemo } from 'react';
import { Source, SBChatMessage } from '../../types';
import { AssistantResponse } from './assistantResponse';
import { MarkdownRenderer } from './markdownRenderer';
import { CheckCircle, Loader2 } from 'lucide-react';

interface MessagePairProps {
    userMessage: SBChatMessage;
    assistantMessage?: SBChatMessage;
    isStreaming: boolean;
    sources: Source[];
}

export const MessagePair = forwardRef<HTMLDivElement, MessagePairProps>(({
    userMessage,
    assistantMessage,
    isStreaming,
    sources,
}, ref) => {
    // Extract user question text
    const userQuestion = useMemo(() => {
        return userMessage.parts.length > 0 && userMessage.parts[0].type === 'text' ? userMessage.parts[0].text : '';
    }, [userMessage]);

    return (
        <div ref={ref}>
            <div className="flex flex-row gap-2 items-center mb-2">
                {isStreaming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <CheckCircle className="w-4 h-4 text-green-700" />
                )}
                <MarkdownRenderer
                    content={`**${userQuestion.trim()}**`}
                    isStreaming={false}
                    className="prose-p:m-0"
                />
            </div>

            {assistantMessage ? (
                <AssistantResponse
                    message={assistantMessage}
                    isStreaming={isStreaming}
                    sources={sources}
                />
            ) : isStreaming && (
                <div className="animate-pulse space-y-4">
                    <div className="h-4 w-1/4 bg-muted rounded" />
                    <div className="space-y-2">
                        <div className="h-3 w-3/4 bg-muted rounded" />
                        <div className="h-3 w-2/3 bg-muted rounded" />
                        <div className="h-3 w-1/2 bg-muted rounded" />
                    </div>
                </div>
            )}
        </div>
    );
});

MessagePair.displayName = 'MessagePair';