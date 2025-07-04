'use client';

import { Loader2 } from 'lucide-react';
import { forwardRef, memo, useMemo } from 'react';
import { MarkdownUIPart } from './markdownUIPart';
import { MessageAvatar } from './messageAvatar';
import { ReasoningUIPart as ReasoningUIPartComponent } from './reasoningUIPart';
import { SBChatMessage } from '../../types';
import { ReadFilesToolComponent } from './tools/readFilesToolComponent';
import { SearchCodeToolComponent } from './tools/searchCodeToolComponent';

interface MessageProps {
    message: SBChatMessage;
    isStreaming: boolean;
}

export const Message = memo(forwardRef<HTMLDivElement, MessageProps>(({ message, isStreaming }, ref) => {

    const parts = useMemo(() => {
        let reasoningIndex = 0;
        return message.parts.map((part) => {
            const output = { part, reasoningIndex }

            if (part.type === 'reasoning') {
                reasoningIndex++;
            }

            return output;
        });
    }, [message.parts]);

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

                    {parts.length > 0 && (
                        <div className="select-text">
                            {parts.map(({ part, reasoningIndex }, index) => {
                                const isActive = isStreaming && index === parts.length - 1;

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
                                    case 'tool-readFiles':
                                        return (
                                            <ReadFilesToolComponent
                                                part={part}
                                            />
                                        )
                                    case 'tool-searchCode':
                                        return (
                                            <SearchCodeToolComponent
                                                part={part}
                                            />
                                        )
                                    case 'reasoning':
                                        const duration = message.metadata?.reasoningDurations?.[reasoningIndex];
                                        return (
                                            <ReasoningUIPartComponent
                                                part={part}
                                                isStreaming={isStreaming}
                                                isActive={isActive}
                                                duration={duration}
                                            />
                                        )
                                    case 'file':
                                    default:
                                        return (
                                            <p>Unknown part type: {part.type}</p>
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
