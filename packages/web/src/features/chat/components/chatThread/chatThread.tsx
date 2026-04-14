'use client';

import { useToast } from '@/components/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CustomSlateEditor } from '@/features/chat/customSlateEditor';
import { AdditionalChatRequestParams, CustomEditor, LanguageModelInfo, SBChatMessage, SearchScope, Source } from '@/features/chat/types';
import { createUIMessage, getAllMentionElements, resetEditor, slateContentToString } from '@/features/chat/utils';
import { useChat } from '@ai-sdk/react';
import { CreateUIMessage, DefaultChatTransport } from 'ai';
import { ArrowDownIcon, CopyIcon } from 'lucide-react';
import { useNavigationGuard } from 'next-navigation-guard';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useStickToBottom } from 'use-stick-to-bottom';
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
import { duplicateChat, generateAndUpdateChatNameFromMessage } from '../../actions';
import { isServiceError } from '@/lib/utils';
import { NotConfiguredErrorBanner } from '../notConfiguredErrorBanner';
import useCaptureEvent from '@/hooks/useCaptureEvent';
import { SignInPromptBanner } from './signInPromptBanner';
import { DuplicateChatDialog } from '@/app/(app)/chat/components/duplicateChatDialog';
import { LoginModal } from '@/app/components/loginModal';
import type { IdentityProviderMetadata } from '@/lib/identityProviders';
import { getAskGhLoginWallData } from '../../actions';

type ChatHistoryState = {
    scrollOffset?: number;
}

const PENDING_MESSAGE_STORAGE_KEY = "askgh_chat_pending_message";

interface ChatThreadProps {
    id?: string | undefined;
    initialMessages?: SBChatMessage[];
    inputMessage?: CreateUIMessage<SBChatMessage>;
    languageModels: LanguageModelInfo[];
    repos: RepositoryQuery[];
    searchContexts: SearchContextQuery[];
    selectedSearchScopes: SearchScope[];
    onSelectedSearchScopesChange: (items: SearchScope[]) => void;
    isOwner?: boolean;
    isAuthenticated?: boolean;
    chatName?: string;
}

export const ChatThread = ({
    id: defaultChatId,
    initialMessages,
    inputMessage,
    languageModels,
    repos,
    searchContexts,
    selectedSearchScopes,
    onSelectedSearchScopesChange,
    isOwner = true,
    isAuthenticated = false,
    chatName,
}: ChatThreadProps) => {
    const [isErrorBannerVisible, setIsErrorBannerVisible] = useState(false);
    const hasSubmittedInputMessage = useRef(false);
    const { scrollRef, contentRef, scrollToBottom, isAtBottom } = useStickToBottom({ initial: false });
    const { toast } = useToast();
    const router = useRouter();
    const [isContextSelectorOpen, setIsContextSelectorOpen] = useState(false);
    const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [loginWallProviders, setLoginWallProviders] = useState<IdentityProviderMetadata[]>([]);
    const hasRestoredPendingMessage = useRef(false);
    const captureEvent = useCaptureEvent();

    // Initial state is from attachments that exist in in the chat history.
    const [sources, setSources] = useState<Source[]>(
        initialMessages?.flatMap((message) =>
            message.parts
                .filter((part) => part.type === 'data-source')
                .map((part) => part.data)
        ) ?? []
    );

    const { selectedLanguageModel } = useSelectedLanguageModel({
        languageModels,
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
                'X-Sourcebot-Client-Source': 'sourcebot-web-client',
            },
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
                selectedSearchScopes,
                languageModel: selectedLanguageModel,
            } satisfies AdditionalChatRequestParams,
        });

        if (
            messages.length === 0 &&
            message.parts.length > 0 &&
            message.parts[0].type === 'text'
        ) {
            generateAndUpdateChatNameFromMessage(
                {
                    chatId,
                    languageModelId: selectedLanguageModel.model,
                    message: message.parts[0].text,
                },
            ).then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `❌ Failed to generate chat name. Reason: ${response.message}`,
                        variant: "destructive",
                    });
                }
                // Refresh the page to update the chat name.
                router.refresh();
            });
        }
    }, [
        selectedLanguageModel,
        _sendMessage,
        selectedSearchScopes,
        messages.length,
        toast,
        chatId,
        router,
    ]);


    const messagePairs = useMessagePairs(messages);

    useNavigationGuard({
        enabled: ({ type }) => {
            // @note: a "refresh" in this context means we have triggered a client side
            // refresh via `router.refresh()`, and not the user pressing "CMD+R"
            // (that would be a "beforeunload" event). We can safely peform refreshes
            // without loosing any unsaved changes.
            if (type === "refresh") {
                return false;
            }

            return status === "streaming" || status === "submitted";
        },
        confirm: () => window.confirm("You have unsaved changes that will be lost."),
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
        scrollToBottom();
        hasSubmittedInputMessage.current = true;
    }, [inputMessage, scrollToBottom, sendMessage]);

    // Restore pending message after OAuth redirect (askgh login wall)
    useEffect(() => {
        if (!isAuthenticated || !isOwner || hasRestoredPendingMessage.current) {
            return;
        }

        const stored = sessionStorage.getItem(PENDING_MESSAGE_STORAGE_KEY);
        if (!stored) {
            return;
        }

        hasRestoredPendingMessage.current = true;
        sessionStorage.removeItem(PENDING_MESSAGE_STORAGE_KEY);

        try {
            const { chatId: storedChatId, children } = JSON.parse(stored) as { chatId: string; children: Descendant[] };

            // Only restore if we're on the same chat that stored the pending message
            if (storedChatId !== chatId) {
                return;
            }

            const text = slateContentToString(children);
            const mentions = getAllMentionElements(children);
            const message = createUIMessage(text, mentions.map(({ data }) => data), selectedSearchScopes);
            sendMessage(message);
            scrollToBottom();
        } catch (error) {
            console.error('Failed to restore pending message:', error);
        }
    }, [isAuthenticated, isOwner, chatId, sendMessage, selectedSearchScopes, scrollToBottom]);

    // Track scroll position for history state restoration.
    useEffect(() => {
        const scrollElement = scrollRef.current;
        if (!scrollElement) {
            return;
        }

        let timeout: NodeJS.Timeout | null = null;

        const handleScroll = () => {
            const scrollOffset = scrollElement.scrollTop;

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
            }, 500);
        };

        scrollElement.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            scrollElement.removeEventListener('scroll', handleScroll);
            if (timeout) {
                clearTimeout(timeout);
            }
        };
    }, [scrollRef]);

    // Restore scroll position from history state on mount.
    useEffect(() => {
        const scrollElement = scrollRef.current;
        if (!scrollElement) {
            return;
        }

        // @hack: without this setTimeout, the scroll position would not be restored
        // at the correct position (it was slightly too high). The theory is that the
        // content hasn't fully rendered yet, so restoring the scroll position too
        // early results in weirdness. Waiting 10ms seems to fix the issue.
        setTimeout(() => {
            const { scrollOffset } = (history.state ?? {}) as ChatHistoryState;
            scrollElement.scrollTo({
                top: scrollOffset ?? 0,
                behavior: 'instant',
            });
        }, 10);
    }, [scrollRef]);


    // Keep the error state & banner visibility in sync.
    useEffect(() => {
        if (error) {
            setIsErrorBannerVisible(true);
        }
    }, [error]);

    const onSubmit = useCallback(async (children: Descendant[], editor: CustomEditor) => {
        if (!isAuthenticated) {
            const result = await getAskGhLoginWallData();
            if (!isServiceError(result) && result.isEnabled) {
                captureEvent('wa_askgh_login_wall_prompted', {});
                sessionStorage.setItem(PENDING_MESSAGE_STORAGE_KEY, JSON.stringify({ chatId, children }));
                setLoginWallProviders(result.providers);
                setIsLoginModalOpen(true);
                return;
            }
        }

        const text = slateContentToString(children);
        const mentions = getAllMentionElements(children);

        const message = createUIMessage(text, mentions.map(({ data }) => data), selectedSearchScopes);
        sendMessage(message);

        scrollToBottom();

        resetEditor(editor);
    }, [sendMessage, selectedSearchScopes, isAuthenticated, captureEvent, chatId, scrollToBottom]);

    const onDuplicate = useCallback(async (newName: string): Promise<string | null> => {
        if (!defaultChatId) {
            return null;
        }

        const result = await duplicateChat({ chatId: defaultChatId, newName });
        if (isServiceError(result)) {
            toast({
                description: `Failed to duplicate chat: ${result.message}`,
                variant: "destructive",
            });
            return null;
        }

        captureEvent('wa_chat_duplicated', { chatId: defaultChatId });
        router.push(`/chat/${result.id}`);
        return result.id;
    }, [defaultChatId, toast, router, captureEvent]);

    return (
        <>
            {error && (
                <ErrorBanner
                    error={error}
                    isVisible={isErrorBannerVisible}
                    onClose={() => setIsErrorBannerVisible(false)}
                />
            )}

            <div className="relative h-full w-full p-4 overflow-hidden min-h-0">
                <div
                    ref={scrollRef}
                    className="h-full w-full overflow-y-auto overflow-x-hidden"
                >
                    <div ref={contentRef}>
                        {
                            messagePairs.length === 0 ? (
                                <div className="flex items-center justify-center text-center h-full min-h-full">
                                    <p className="text-muted-foreground">no messages</p>
                                </div>
                            ) : (
                                <>
                                    {messagePairs.map(([userMessage, assistantMessage], index) => {
                                        const isLastPair = index === messagePairs.length - 1;
                                        const isStreaming = isLastPair && (status === "streaming" || status === "submitted");
                                        // Use a stable key based on user message ID
                                        const key = userMessage.id;

                                        return (
                                            <Fragment key={key}>
                                                <ChatThreadListItem
                                                    index={index}
                                                    chatId={chatId}
                                                    userMessage={userMessage}
                                                    assistantMessage={assistantMessage}
                                                    isStreaming={isStreaming}
                                                    sources={sources}
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
                    </div>
                </div>
                {
                    (!isAtBottom && status === "streaming") && (
                        <div className="absolute bottom-5 left-0 right-0 h-10 flex flex-row items-center justify-center">
                            <Button
                                variant="outline"
                                size="icon"
                                className="rounded-full animate-bounce-slow h-8 w-8"
                                onClick={() => scrollToBottom('instant')}
                            >
                                <ArrowDownIcon className="w-4 h-4" />
                            </Button>
                        </div>
                    )
                }
            </div>
            <div className="w-full max-w-3xl mx-auto mb-8">
                <SignInPromptBanner
                    chatId={chatId}
                    isAuthenticated={isAuthenticated}
                    isOwner={isOwner}
                    hasMessages={messages.length > 0}
                    isStreaming={status === "streaming" || status === "submitted"}
                />
                {isOwner ? (
                    <>
                        {languageModels.length === 0 && (
                            <NotConfiguredErrorBanner className="mb-2" />
                        )}

                        <div className="border rounded-md w-full shadow-sm">
                            <CustomSlateEditor>
                                <ChatBox
                                    onSubmit={onSubmit}
                                    className="min-h-[80px]"
                                    preferredSuggestionsBoxPlacement="top-start"
                                    isGenerating={status === "streaming" || status === "submitted"}
                                    onStop={stop}
                                    languageModels={languageModels}
                                    selectedSearchScopes={selectedSearchScopes}
                                    searchContexts={searchContexts}
                                    isDisabled={languageModels.length === 0}
                                />
                                <div className="w-full flex flex-row items-center bg-accent rounded-b-md px-2">
                                    <ChatBoxToolbar
                                        languageModels={languageModels}
                                        repos={repos}
                                        searchContexts={searchContexts}
                                        selectedSearchScopes={selectedSearchScopes}
                                        onSelectedSearchScopesChange={onSelectedSearchScopesChange}
                                        isContextSelectorOpen={isContextSelectorOpen}
                                        onContextSelectorOpenChanged={setIsContextSelectorOpen}
                                    />
                                </div>
                            </CustomSlateEditor>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-row items-center justify-center gap-3 p-4 border rounded-md bg-muted/50">
                        <p className="text-sm text-muted-foreground">This chat is read-only.</p>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => setIsDuplicateDialogOpen(true)}
                        >
                            <CopyIcon className="h-4 w-4" />
                            Duplicate
                        </Button>
                        <DuplicateChatDialog
                            isOpen={isDuplicateDialogOpen}
                            onOpenChange={setIsDuplicateDialogOpen}
                            onDuplicate={onDuplicate}
                            currentName={chatName ?? 'Untitled chat'}
                        />
                    </div>
                )}
            </div>

            <LoginModal
                isOpen={isLoginModalOpen}
                onOpenChange={setIsLoginModalOpen}
                providers={loginWallProviders}
                callbackUrl={typeof window !== 'undefined' ? window.location.href : ''}
            />
        </>
    );
}
