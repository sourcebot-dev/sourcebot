'use client';

import { UIMessage } from 'ai';
import { Loader2 } from 'lucide-react';
import { forwardRef, memo, useMemo } from 'react';
import { MarkdownUIPart } from './markdownUIPart';
import { MessageAvatar } from './messageAvatar';
import { ToolUIPart } from './toolUIPart';
import { ReasoningUIPart as ReasoningUIPartComponent } from './reasoningUIPart';
import { TextUIPart, ReasoningUIPart, ToolInvocationUIPart, SourceUIPart, FileUIPart, StepStartUIPart } from '@ai-sdk/ui-utils';

interface MessageProps {
    message: UIMessage;
    isStreaming: boolean;
}

export const Message = memo(forwardRef<HTMLDivElement, MessageProps>(({ message, isStreaming }, ref) => {
    return (
        <div
            ref={ref}
            key={message.id}
            className="group animate-in fade-in duration-200"
        >
            <div className="flex items-start gap-3 group">
                <MessageAvatar role={message.role} />

                <div className="flex-1 space-y-2 overflow-hidden">
                    {message.role === "assistant" && isStreaming && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Thinking...</span>
                        </div>
                    )}

                    {message.parts.length > 0 && (
                        <div className="select-text">
                            {message.parts.map((part, index) => {
                                return (
                                    <MessagePart
                                        key={`${message.id}-${index}`}
                                        part={part}
                                        isStreaming={isStreaming}
                                        isLatestPart={index === message.parts.length - 1}
                                    />
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}));

Message.displayName = 'Message';

interface MessagePartProps {
    part: TextUIPart | ReasoningUIPart | ToolInvocationUIPart | SourceUIPart | FileUIPart | StepStartUIPart;
    isStreaming: boolean;
    isLatestPart: boolean;
}

const MessagePart = ({ part, isStreaming, isLatestPart }: MessagePartProps) => {
    const isActive = useMemo(() => {
        return isStreaming && isLatestPart;
    }, [isStreaming, isLatestPart]);

    switch (part.type) {
        case 'text':
            return (
                <MarkdownUIPart
                    content={part.text}
                    isStreaming={isStreaming}
                />
            )
        case 'step-start':
            break;
        case 'tool-invocation':
            return (
                <ToolUIPart
                    part={part}
                />
            )
        case 'reasoning':
            return (
                <ReasoningUIPartComponent
                    part={part}
                    isStreaming={isStreaming}
                    isActive={isActive}
                />
            )
        case 'source':
        case 'file':
        default:
            return (
                <p>Unknown part type: {part.type}</p>
            )
    }
}
