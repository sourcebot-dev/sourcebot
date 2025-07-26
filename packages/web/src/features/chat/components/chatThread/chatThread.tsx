'use client';

import { useToast } from '@/components/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { CustomSlateEditor } from '@/features/chat/customSlateEditor';
import { AdditionalChatRequestParams, CustomEditor, LanguageModelInfo, SBChatMessage, Source } from '@/features/chat/types';
import { createUIMessage, getAllMentionElements, resetEditor, slateContentToString } from '@/features/chat/utils';
import { useDomain } from '@/hooks/useDomain';
import { useChat } from '@ai-sdk/react';
import { CreateUIMessage, DefaultChatTransport } from 'ai';
import { ArrowDownIcon } from 'lucide-react';
import { useNavigationGuard } from 'next-navigation-guard';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Descendant } from 'slate';
import { useMessagePairs } from '../../useMessagePairs';
import { useSelectedLanguageModel } from '../../useSelectedLanguageModel';
import { ChatBox } from '../chatBox';
import { ChatBoxToolbar } from '../chatBox/chatBoxToolbar';
import { ChatThreadListItem } from './chatThreadListItem';
import { ErrorBanner } from './errorBanner';
import { useRouter } from 'next/navigation';
import { usePrevious } from '@uidotdev/usehooks';
import { RepositoryQuery, SearchContextQuery } from '@/lib/types';
import { ContextItem } from '../chatBox/contextSelector';

type ChatHistoryState = {
    scrollOffset?: number;
}

interface ChatThreadProps {
    id?: string | undefined;
    initialMessages?: SBChatMessage[];
    inputMessage?: CreateUIMessage<SBChatMessage>;
    languageModels: LanguageModelInfo[];
    repos: RepositoryQuery[];
    searchContexts: SearchContextQuery[];
    selectedItems: ContextItem[];
    onSelectedItemsChange: (items: ContextItem[]) => void;
    isChatReadonly: boolean;
}

export const ChatThread = ({
    id: defaultChatId,
    initialMessages,
    inputMessage,
    languageModels,
    repos,
    searchContexts,
    selectedItems,
    onSelectedItemsChange,
    isChatReadonly,
}: ChatThreadProps) => {
    const domain = useDomain();
    const [isErrorBannerVisible, setIsErrorBannerVisible] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const latestMessagePairRef = useRef<HTMLDivElement>(null);
    const hasSubmittedInputMessage = useRef(false);
    const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(false);
    const { toast } = useToast();
    const router = useRouter();
    const [isContextSelectorOpen, setIsContextSelectorOpen] = useState(false);

    const { selectedRepos, selectedContexts } = useMemo(() => {
        const repos = selectedItems.filter(item => item.type === 'repo').map(item => item.value);
        const contexts = selectedItems.filter(item => item.type === 'context').map(item => item.value);
        return { selectedRepos: repos, selectedContexts: contexts };
    }, [selectedItems]);

    // Initial state is from attachments that exist in in the chat history.
    const [sources, setSources] = useState<Source[]>(
        initialMessages?.flatMap((message) =>
            message.parts
                .filter((part) => part.type === 'data-source')
                .map((part) => part.data)
        ) ?? []
    );

    const { selectedLanguageModel } = useSelectedLanguageModel({
        initialLanguageModel: languageModels.length > 0 ? languageModels[0] : undefined,
    });

    const {
        messages,
        sendMessage: _sendMessage,
        error,
        status,
        stop,
        id: chatId,
    } = useChat<SBChatMessage>({
        id: defaultChatId,
        messages: initialMessages,
        transport: new DefaultChatTransport({
            api: '/api/chat',
            headers: {
                "X-Org-Domain": domain,
            }
        }),
        onData: (dataPart) => {
            // Keeps sources added by the assistant in sync.
            if (dataPart.type === 'data-source') {
                setSources((prev) => [...prev, dataPart.data]);
            }
        }
    });

    const sendMessage = useCallback((message: CreateUIMessage<SBChatMessage>) => {
        if (!selectedLanguageModel) {
            toast({
                description: "Failed to send message. No language model selected.",
                variant: "destructive",
            });
            return;
        }

        // Keeps sources added by the user in sync.
        const sources = message.parts
            .filter((part) => part.type === 'data-source')
            .map((part) => part.data);
        setSources((prev) => [...prev, ...sources]);

        _sendMessage(message, {
            body: {
                selectedRepos,
                selectedContexts,
                languageModelId: selectedLanguageModel.model,
            } satisfies AdditionalChatRequestParams,
        });
    }, [_sendMessage, selectedLanguageModel, toast, selectedRepos, selectedContexts]);


    const messagePairs = useMessagePairs(messages);

    useNavigationGuard({
        enabled: status === "streaming" || status === "submitted",
        confirm: () => window.confirm("You have unsaved changes that will be lost.")
    });

    // When the chat is finished, refresh the page to update the chat history.
    const prevStatus = usePrevious(status);
    useEffect(() => {
        const wasPending = prevStatus === "submitted" || prevStatus === "streaming";
        const isFinished = status === "error" || status === "ready";

        if (wasPending && isFinished) {
            router.refresh();
        }
    }, [prevStatus, status, router]);

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
            behavior: 'smooth',
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

        const message = createUIMessage(text, mentions.map(({ data }) => data), selectedRepos, selectedContexts);
        sendMessage(message);

        setIsAutoScrollEnabled(true);

        resetEditor(editor);
    }, [sendMessage, selectedRepos, selectedContexts]);

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
                                    <Fragment key={index}>
                                        <ChatThreadListItem
                                            index={index}
                                            chatId={chatId}
                                            userMessage={userMessage}
                                            assistantMessage={assistantMessage}
                                            isStreaming={isStreaming}
                                            sources={sources}
                                            ref={isLastPair ? latestMessagePairRef : undefined}
                                        />
                                        {index !== messagePairs.length - 1 && (
                                            <Separator className="my-12" />
                                        )}
                                    </Fragment>
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
            </ScrollArea>
            {!isChatReadonly && (
                <div className="border rounded-md w-full max-w-3xl mx-auto mb-8 shadow-sm">
                    <CustomSlateEditor>
                        <ChatBox
                            onSubmit={onSubmit}
                            className="min-h-[80px]"
                            preferredSuggestionsBoxPlacement="top-start"
                            isGenerating={status === "streaming" || status === "submitted"}
                            onStop={stop}
                            languageModels={languageModels}
                            selectedItems={selectedItems}
                            searchContexts={searchContexts}
                            onContextSelectorOpenChanged={setIsContextSelectorOpen}
                        />
                        <div className="w-full flex flex-row items-center bg-accent rounded-b-md px-2">
                            <ChatBoxToolbar
                                languageModels={languageModels}
                                repos={repos}
                                searchContexts={searchContexts}
                                selectedItems={selectedItems}
                                onSelectedItemsChange={onSelectedItemsChange}
                                isContextSelectorOpen={isContextSelectorOpen}
                                onContextSelectorOpenChanged={setIsContextSelectorOpen}
                            />
                        </div>
                    </CustomSlateEditor>
                </div>
            )}
        </>
    );
}
