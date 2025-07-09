'use client';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CustomSlateEditor } from '@/features/chat/customSlateEditor';
import { CustomEditor, ModelProviderInfo, SBChatMessage } from '@/features/chat/types';
import { getAllMentionElements, resetEditor, slateContentToString } from '@/features/chat/utils';
import { useChat } from '@ai-sdk/react';
import { CreateUIMessage, DefaultChatTransport } from 'ai';
import { ArrowDownIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Descendant } from 'slate';
import { ChatBox } from '../chatBox';
import { ChatBoxTools } from '../chatBoxTools';
import { ErrorBanner } from './errorBanner';
import { useDomain } from '@/hooks/useDomain';
import { useQueryClient } from '@tanstack/react-query';
import { MessagePair } from './messagePair';
import { useNavigationGuard } from 'next-navigation-guard';
import { Separator } from '@/components/ui/separator';
import { useExtractChatContext } from '../../useExtractChatContext';
import { useMessagePairs } from '../../useMessagePairs';

type ChatHistoryState = {
    scrollOffset?: number;
}

interface ChatThreadProps {
    id?: string | undefined;
    initialMessages?: SBChatMessage[];
    inputMessage?: CreateUIMessage<SBChatMessage>;
    defaultSelectedRepos?: string[];
    modelProviderInfo?: ModelProviderInfo;
}

export const ChatThread = ({
    id,
    initialMessages,
    inputMessage,
    defaultSelectedRepos,
    modelProviderInfo,
}: ChatThreadProps = {}) => {
    const domain = useDomain();
    const [selectedRepos, setSelectedRepos] = useState<string[]>(defaultSelectedRepos ?? []);
    const [isErrorBannerVisible, setIsErrorBannerVisible] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const latestMessagePairRef = useRef<HTMLDivElement>(null);
    const hasSubmittedInputMessage = useRef(false);
    const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(false);
    const queryClient = useQueryClient();
   
    const {
        messages,
        sendMessage,
        error,
        status,
        stop,
    } = useChat<SBChatMessage>({
        id,
        messages: initialMessages,
        transport: new DefaultChatTransport({
            api: '/api/chat',
            body: {
                selectedRepos,
            },
            headers: {
                "X-Org-Domain": domain,
            }
        }),
        onFinish: () => {
            queryClient.invalidateQueries(
                {
                    queryKey: ['chat'],
                },
            );
        }
    });

    const messagePairs = useMessagePairs(messages);
    const chatContext = useExtractChatContext(messages);

    useNavigationGuard({
        enabled: status === "streaming" || status === "submitted",
        confirm: () => window.confirm("You have unsaved changes that will be lost.")
    })

    useEffect(() => {
        if (!inputMessage || hasSubmittedInputMessage.current) {
            return;
        }

        sendMessage(inputMessage);
        setIsAutoScrollEnabled(true);
        hasSubmittedInputMessage.current = true;
    }, [inputMessage, sendMessage]);

    // Track scroll position changes.
    useEffect(() => {
        const scrollElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
        if (!scrollElement) return;

        let timeout: NodeJS.Timeout | null = null;

        const handleScroll = () => {
            const scrollOffset = scrollElement.scrollTop;

            const threshold = 50; // pixels from bottom to consider "at bottom"
            const { scrollHeight, clientHeight } = scrollElement;
            const isAtBottom = scrollHeight - scrollOffset - clientHeight <= threshold;
            setIsAutoScrollEnabled(isAtBottom);

            // Debounce the history state update
            if (timeout) {
                clearTimeout(timeout);
            }

            timeout = setTimeout(() => {
                history.replaceState(
                    {
                        scrollOffset,
                    } satisfies ChatHistoryState,
                    '',
                    window.location.href
                );
            }, 300);
        };

        scrollElement.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            scrollElement.removeEventListener('scroll', handleScroll);
            if (timeout) {
                clearTimeout(timeout);
            }
        };
    }, []);

    useEffect(() => {
        const scrollElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
        if (!scrollElement) {
            return;
        }

        const { scrollOffset } = (history.state ?? {}) as ChatHistoryState;
        scrollElement.scrollTo({
            top: scrollOffset ?? 0,
            behavior: 'instant',
        });
    }, []);

    // When messages are being streamed, scroll to the latest message
    // assuming auto scrolling is enabled.
    useEffect(() => {
        if (
            !latestMessagePairRef.current ||
            !isAutoScrollEnabled ||
            messages.length === 0
        ) {
            return;
        }

        latestMessagePairRef.current.scrollIntoView({
            behavior: 'instant',
            block: 'end',
            inline: 'nearest',
        });

    }, [isAutoScrollEnabled, messages]);
    

    // Keep the error state & banner visibility in sync.
    useEffect(() => {
        if (error) {
            setIsErrorBannerVisible(true);
        }
    }, [error]);

    const onSubmit = useCallback((children: Descendant[], editor: CustomEditor) => {
        const text = slateContentToString(children);
        const mentions = getAllMentionElements(children);

        sendMessage({
            text,
            metadata: {
                mentions: mentions.map((mention) => mention.data),
            }
        })

        setIsAutoScrollEnabled(true);

        resetEditor(editor);
    }, [sendMessage]);

    return (
        <>
            {error && (
                <ErrorBanner
                    error={error}
                    isVisible={isErrorBannerVisible}
                    onClose={() => setIsErrorBannerVisible(false)}
                />
            )}

            <ScrollArea
                ref={scrollAreaRef}
                className="flex flex-col h-full w-full p-4 overflow-hidden"
            >
                <div
                    className="max-w-[1500px] mx-auto space-y-6"
                >
                    {
                        messagePairs.length === 0 ? (
                            <div className="flex items-center justify-center text-center h-full">
                                <p className="text-muted-foreground">no messages</p>
                            </div>
                        ) : (
                            <>
                                {messagePairs.map(([userMessage, assistantMessage], index) => {
                                    const isLastPair = index === messagePairs.length - 1;
                                    const isStreaming = isLastPair && (status === "streaming" || status === "submitted");
                                    
                                    return (
                                        <>
                                            <MessagePair
                                                key={index}
                                                userMessage={userMessage}
                                                assistantMessage={assistantMessage}
                                                isStreaming={isStreaming}
                                                ref={isLastPair ? latestMessagePairRef : null}
                                                chatContext={chatContext}
                                            />
                                            {index !== messagePairs.length - 1 && (
                                                <Separator className="my-4" />
                                            )}
                                        </>
                                    );
                                })}
                            </>
                        )
                    }
                    {
                        (!isAutoScrollEnabled && status === "streaming") && (
                            <div className="absolute bottom-5 left-0 right-0 h-10 flex flex-row items-center justify-center">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="rounded-full animate-bounce-slow h-8 w-8"
                                    onClick={() => {
                                        latestMessagePairRef.current?.scrollIntoView({
                                            behavior: 'instant',
                                            block: 'end',
                                            inline: 'nearest',
                                        });
                                    }}
                                >
                                    <ArrowDownIcon className="w-4 h-4" />
                                </Button>
                            </div>
                        )
                    }
                </div>
            </ScrollArea>
            <div className="border rounded-md w-full max-w-3xl mx-auto mb-8 shadow-sm">
                <CustomSlateEditor>
                    <ChatBox
                        onSubmit={onSubmit}
                        className="min-h-[80px]"
                        preferredSuggestionsBoxPlacement="top-start"
                        selectedRepos={selectedRepos}
                        isGenerating={status === "streaming" || status === "submitted"}
                        onStop={stop}
                    />
                    <div className="w-full flex flex-row items-center bg-accent rounded-b-md px-2">
                        <ChatBoxTools
                            selectedRepos={selectedRepos}
                            onSelectedReposChange={setSelectedRepos}
                            modelProviderInfo={modelProviderInfo}
                        />
                    </div>
                </CustomSlateEditor>
            </div>
        </>
    );
}
