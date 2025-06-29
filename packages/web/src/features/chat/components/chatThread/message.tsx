'use client';

import { UIMessage } from 'ai';
import { Loader2 } from 'lucide-react';
import { forwardRef, memo } from 'react';
import { MarkdownUIPart } from './markdownUIPart';
import { MessageAvatar } from './messageAvatar';
import { ToolUIPart } from './toolUIPart';

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
                        <div>
                            {message.parts.map((part, index) => {
                                switch (part.type) {
                                    case 'text':
                                        return (
                                            <MarkdownUIPart
                                                key={index}
                                                part={part}
                                                isStreaming={isStreaming}
                                            />
                                        )
                                    case 'step-start':
                                        break;
                                    case 'tool-invocation':
                                        return (
                                            <ToolUIPart
                                                key={index}
                                                part={part}
                                            />
                                        )
                                    case 'reasoning':
                                    case 'source':
                                    case 'file':
                                    default:
                                        return (
                                            <p key={index}>Unknown part type: {part.type}</p>
                                        )
                                }
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}));

Message.displayName = 'Message';
