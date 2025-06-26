'use client';


import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useThemeNormalized } from '@/hooks/useThemeNormalized';
import { UIMessage } from 'ai';
import { Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { forwardRef, memo } from 'react';
import { MarkdownUIPart } from './markdownUIPart';
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


interface MessageAvatarProps {
    role: UIMessage['role'];
}

const MessageAvatar = ({ role }: MessageAvatarProps) => {
    const { data: session } = useSession();
    const { theme } = useThemeNormalized();

    return (
        <Avatar className="h-7 w-7 rounded-full">
            <AvatarFallback className="text-xs">{role === "user" ? "U" : "AI"}</AvatarFallback>
            {role === "user" ? (
                <AvatarImage src={session?.user.image ?? "/placeholder_avatar.png?height=32&width=32"} />
            ) : (
                <AvatarImage
                    src={`/${theme === 'dark' ? 'sb_logo_dark_small' : 'sb_logo_light_small'}.png?height=32&width=32`}
                />
            )}
        </Avatar>
    )
}

