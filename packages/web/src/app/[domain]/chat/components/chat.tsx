'use client';

import { Separator } from '@/components/ui/separator';
import { useDomain } from '@/hooks/useDomain';
import { Message, useChat } from '@ai-sdk/react';
import { TopBar } from '../../components/topBar';
import { useState, useEffect, useCallback } from 'react';
import { ErrorBanner } from './errorBanner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CustomSlateEditor } from '@/features/chat/customSlateEditor';
import { ChatBox } from './chatBox';
import { getAllMentionElements, resetEditor, toString } from '@/features/chat/utils';
import { ChatBoxTools } from './chatBoxTools';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import { UIMessage } from 'ai';
import { useSession } from 'next-auth/react';
import { HammerIcon } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ToolInvocationUIPart } from '@ai-sdk/ui-utils';

export default function Chat({
    id,
    initialMessages,
}: { id?: string | undefined; initialMessages?: Message[] } = {}) {
    const {
        append,
        messages,
        error,
        status,
    } = useChat({
        id,
        initialMessages,
        sendExtraMessageFields: true,
    });

    const domain = useDomain();

    const [isErrorBannerVisible, setIsErrorBannerVisible] = useState(false);

    // Keep the error state & banner visibility in sync.
    useEffect(() => {
        if (error) {
            setIsErrorBannerVisible(true);
        }
    }, [error]);

    // simplified rendering code, extend as needed:
    return (
        <div className="flex flex-col h-screen">
            <div className='sticky top-0 left-0 right-0 z-10'>
                <TopBar
                    domain={domain}
                />
                <Separator />
            </div>
            {error && (
                <ErrorBanner
                    error={error}
                    isVisible={isErrorBannerVisible}
                    onClose={() => setIsErrorBannerVisible(false)}
                />
            )}

            <ScrollArea className="flex flex-col h-full w-full p-4 overflow-hidden">
                <div className="max-w-4xl mx-auto space-y-6">
                    {
                        messages.length === 0 ? (
                            <div className="flex items-center justify-center text-center h-full">
                                <p className="text-muted-foreground">no messages</p>
                            </div>
                        ) : (
                            <>
                                {messages.map((m, index) => (
                                    <MessageComponent
                                        key={m.id}
                                        message={m}
                                        isLatestMessage={index === messages.length - 1}
                                        status={status}
                                    />
                                ))}
                            </>
                        )
                    }
                </div>
            </ScrollArea>
            <div className="border rounded-md w-full max-w-4xl mx-auto mb-8">
                <CustomSlateEditor>
                    <ChatBox
                        onSubmit={(children, editor) => {
                            const text = toString(children);
                            const mentions = getAllMentionElements(children);

                            append({
                                role: "user",
                                content: text,
                                annotations: mentions.map((mention) => mention.data),
                            });

                            resetEditor(editor);
                        }}
                        className="min-h-[80px]"
                        preferredSuggestionsBoxPlacement="top-start"
                    />
                    <div className="w-full flex flex-row items-center bg-accent rounded-b-md px-2">
                        <ChatBoxTools />
                    </div>
                </CustomSlateEditor>
            </div>
        </div>
    );
}

interface MessageComponentProps {
    message: UIMessage;
    isLatestMessage: boolean;
    status: 'submitted' | 'streaming' | 'ready' | 'error';
}

const MessageComponent = ({ message, isLatestMessage, status }: MessageComponentProps) => {

    const { data: session } = useSession();

    return (
        <div key={message.id} className="group animate-in fade-in duration-200">
            <div className="flex items-start gap-3 group">
                <Avatar className="h-7 w-7 rounded-full border">
                    <AvatarFallback className="text-xs">{message.role === "user" ? "U" : "AI"}</AvatarFallback>
                    {message.role === "user" ? (
                        <AvatarImage src={session?.user.image ?? ""} />
                    ) : (
                        <AvatarImage src="/placeholder.svg?height=32&width=32" />
                    )}
                </Avatar>

                <div className="flex-1 space-y-2 overflow-hidden">
                    {isLatestMessage && message.role === "assistant" && status === "streaming" && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Thinking...</span>
                        </div>
                    )}

                    {/* Tool calls indicators */}
                    {message.parts.length > 0 && (
                        <div className="space-y-2">
                            {message.parts.map((part, index) => {
                                switch (part.type) {
                                    case 'text':
                                        return (
                                            <p key={index}>{part.text}</p>
                                        )
                                    case 'step-start':
                                        break;
                                    case 'tool-invocation':
                                        return (
                                            <ToolInvocationUIPartComponent
                                                key={index}
                                                part={part}
                                            />
                                        )
                                    case 'reasoning':
                                    case 'source':
                                    case 'file':
                                    default:
                                        console.log("Unknown part type:", part);
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
}

const ToolInvocationUIPartComponent = ({ part }: { part: ToolInvocationUIPart }) => {
    if (part.type !== 'tool-invocation') {
        return null;
    }

    const { toolName, state } = part.toolInvocation;

    return (
        <div className="flex items-center gap-2">
            <HammerIcon className="h-4 w-4" />
            <p>{toolName}</p>
            <span className="text-xs text-gray-500">{state}</span>
            {state === 'result' && (
                <Accordion type="single" collapsible>
                    <AccordionItem value="result">
                        <AccordionTrigger>View Invocation</AccordionTrigger>
                        <AccordionContent>
                            <p>Arguments:</p>
                            <pre className="text-xs text-gray-500 whitespace-pre-wrap break-all">
                                {JSON.stringify(part.toolInvocation.args, null, 2)}
                            </pre>
                            <p>Result:</p>
                            <pre className="text-xs text-gray-500 whitespace-pre-wrap break-all">
                                {JSON.stringify(part.toolInvocation.result, null, 2)}
                            </pre>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            )}
        </div>
    )
}