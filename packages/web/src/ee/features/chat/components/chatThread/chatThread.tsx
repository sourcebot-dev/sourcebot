'use client';

import { useToast } from '@/components/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CustomSlateEditor } from '@/features/chat/customSlateEditor';
import { AdditionalChatRequestParams, AttachmentData, CustomEditor, LanguageModelInfo, SBChatMessage, SearchScope, Source } from '@/features/chat/types';
import { createUIMessage, getAllMentionElements, getTurnProgressState, getUserMessageText, resetEditor, slateContentToString } from '@/features/chat/utils';
import { useChat } from '@ai-sdk/react';
import { CreateUIMessage, DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai';
import { ArrowDownIcon, CopyIcon } from 'lucide-react';
import { useNavigationGuard } from 'next-navigation-guard';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStickToBottom } from 'use-stick-to-bottom';
import { Descendant } from 'slate';
import { useMessagePairs } from '../../useMessagePairs';
import { useSelectedLanguageModel } from '@/features/chat/useSelectedLanguageModel';
import { ChatBox, ChatBoxHandle } from '@/features/chat/components/chatBox';
import { ChatBoxToolbar } from '@/features/chat/components/chatBox/chatBoxToolbar';
import { ChatPaneDropzone } from '@/features/chat/components/chatBox/chatPaneDropzone';
import { ChatThreadListItem } from './chatThreadListItem';
import { ErrorBanner } from './errorBanner';
import { McpFailedServersBanner } from './mcpFailedServersBanner';
import { useRouter } from 'next/navigation';
import { usePrevious } from '@uidotdev/usehooks';
import { RepositoryQuery, SearchContextQuery } from '@/lib/types';
import { duplicateChat } from '@/features/chat/actions';
import { generateAndUpdateChatNameFromMessage } from '@/ee/features/chat/actions';
import { isServiceError } from '@/lib/utils';
import { NotConfiguredErrorBanner } from '@/features/chat/components/notConfiguredErrorBanner';
import { McpServerIconContext, McpServerIconMap } from '../../mcpServerIconContext';
import { ToolApprovalProvider } from '../../toolApprovalContext';
import useCaptureEvent from '@/hooks/useCaptureEvent';
import { SignInPromptBanner } from './signInPromptBanner';
import { DuplicateChatDialog } from '@/app/(app)/chat/components/duplicateChatDialog';

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
    selectedSearchScopes: SearchScope[];
    onSelectedSearchScopesChange: (items: SearchScope[]) => void;
    disabledMcpServerIds: string[];
    onDisabledMcpServerIdsChange: (ids: string[]) => void;
    isOwner?: boolean;
    isAuthenticated: boolean;
    isLoginWallEnabled: boolean;
    maxImageBytes: number;
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
    disabledMcpServerIds,
    onDisabledMcpServerIdsChange,
    isOwner = true,
    isAuthenticated,
    isLoginWallEnabled,
    maxImageBytes,
    chatName,
}: ChatThreadProps) => {
    const [isErrorBannerVisible, setIsErrorBannerVisible] = useState(false);
    const hasSubmittedInputMessage = useRef(false);
    const chatBoxRef = useRef<ChatBoxHandle>(null);
    const { scrollRef, contentRef, scrollToBottom, isAtBottom } = useStickToBottom({ initial: false });
    const { toast } = useToast();
    const router = useRouter();
    const [isContextSelectorOpen, setIsContextSelectorOpen] = useState(false);
    const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
    const captureEvent = useCaptureEvent();

    // Initial state is from attachments that exist in in the chat history.
    const [sources, setSources] = useState<Source[]>(
        initialMessages?.flatMap((message) =>
            message.parts
                .filter((part) => part.type === 'data-source')
                .map((part) => part.data)
        ) ?? []
    );

    const [mcpServerIconMap, setMcpServerIconMap] = useState<McpServerIconMap>(() => {
        const map: McpServerIconMap = {};
        initialMessages?.forEach((message) => {
            message.parts
                .filter((part) => part.type === 'data-mcp-server')
                .forEach((part) => {
                    map[part.data.sanitizedName] = part.data.faviconUrl;
                });
        });
        return map;
    });

    const [failedMcpServers, setFailedMcpServers] = useState<string[]>(() => {
        const names: string[] = [];
        initialMessages?.forEach((message) => {
            message.parts
                .filter((part) => part.type === 'data-mcp-failed-server')
                .forEach((part) => {
                    if (!names.includes(part.data.serverName)) {
                        names.push(part.data.serverName);
                    }
                });
        });
        return names;
    });
    const [isFailedMcpBannerVisible, setIsFailedMcpBannerVisible] = useState(false);

    const { selectedLanguageModel } = useSelectedLanguageModel();

    // Refs to capture the latest request params for the transport body.
    // The transport is created once (useMemo) but params change over time,
    // so refs ensure the dynamic body function always reads current values.
    const searchScopesRef = useRef(selectedSearchScopes);
    const modelRef = useRef(selectedLanguageModel);
    const disabledMcpRef = useRef(disabledMcpServerIds);

    useEffect(() => { searchScopesRef.current = selectedSearchScopes; }, [selectedSearchScopes]);
    useEffect(() => { modelRef.current = selectedLanguageModel; }, [selectedLanguageModel]);
    useEffect(() => { disabledMcpRef.current = disabledMcpServerIds; }, [disabledMcpServerIds]);

    const getTransportBody = useCallback(() => ({
        selectedSearchScopes: searchScopesRef.current,
        languageModel: modelRef.current,
        disabledMcpServerIds: disabledMcpRef.current,
    }), []);

    // Transport with dynamic body, resolved on every request, including auto-resends
    // triggered by sendAutomaticallyWhen after tool approval.
    // eslint-disable-next-line react-hooks/refs -- DefaultChatTransport stores the body callback and invokes it during requests, not during render.
    const transport = useMemo(() => new DefaultChatTransport({
        api: '/api/ee/chat',
        headers: {
            'X-Sourcebot-Client-Source': 'sourcebot-web-client',
        },
        body: getTransportBody,
    }), [getTransportBody]);

    const {
        messages,
        sendMessage: _sendMessage,
        addToolApprovalResponse,
        error,
        status,
        stop,
        id: chatId,
    } = useChat<SBChatMessage>({
        id: defaultChatId,
        messages: initialMessages,
        transport,
        sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
        onData: (dataPart) => {
            // Keeps sources added by the assistant in sync.
            if (dataPart.type === 'data-source') {
                setSources((prev) => [...prev, dataPart.data]);
            }
            if (dataPart.type === 'data-mcp-server') {
                setMcpServerIconMap((prev) => ({
                    ...prev,
                    [dataPart.data.sanitizedName]: dataPart.data.faviconUrl,
                }));
            }
            if (dataPart.type === 'data-mcp-failed-server') {
                setFailedMcpServers((prev) => {
                    if (prev.includes(dataPart.data.serverName)) {
                        return prev;
                    }
                    return [...prev, dataPart.data.serverName];
                });
                setIsFailedMcpBannerVisible(true);
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
                disabledMcpServerIds,
            } satisfies AdditionalChatRequestParams,
        });

        const userMessageText = getUserMessageText(message);
        if (
            messages.length === 0 &&
            userMessageText.length > 0
        ) {
            generateAndUpdateChatNameFromMessage(
                {
                    chatId,
                    languageModelId: selectedLanguageModel.model,
                    message: userMessageText,
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
        disabledMcpServerIds,
        messages.length,
        toast,
        chatId,
        router,
    ]);


    const messagePairs = useMessagePairs(messages);
    const {
        isTurnInProgress,
        isNetworkActive,
        isAwaitingToolApproval,
        shouldGuardNavigation,
    } = useMemo(() => getTurnProgressState({ messages, status }), [messages, status]);

    useNavigationGuard({
        enabled: ({ type }) => {
            // @note: a "refresh" in this context means we have triggered a client side
            // refresh via `router.refresh()`, and not the user pressing "CMD+R"
            // (that would be a "beforeunload" event). We can safely peform refreshes
            // without loosing any unsaved changes.
            if (type === "refresh") {
                return false;
            }

            return shouldGuardNavigation;
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

    const onSubmit = useCallback(async (children: Descendant[], editor: CustomEditor, attachments: AttachmentData[]) => {
        const text = slateContentToString(children);
        const mentions = getAllMentionElements(children);

        const message = createUIMessage(text, mentions.map(({ data }) => data), selectedSearchScopes, disabledMcpServerIds, attachments);
        sendMessage(message);

        scrollToBottom();

        resetEditor(editor);
    }, [sendMessage, selectedSearchScopes, disabledMcpServerIds, scrollToBottom]);

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
        <ToolApprovalProvider value={addToolApprovalResponse}>
        <McpServerIconContext.Provider value={mcpServerIconMap}>
        <ChatPaneDropzone
            className="flex flex-col flex-1 min-h-0 w-full"
            onFilesDropped={(files) => chatBoxRef.current?.addFiles(files)}
            disabled={!isOwner || languageModels.length === 0}
        >
            {error && (
                <ErrorBanner
                    error={error}
                    isVisible={isErrorBannerVisible}
                    onClose={() => setIsErrorBannerVisible(false)}
                />
            )}
            <McpFailedServersBanner
                serverNames={failedMcpServers}
                isVisible={isFailedMcpBannerVisible}
                onClose={() => setIsFailedMcpBannerVisible(false)}
            />

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
                                        const isPairTurnInProgress = isLastPair && isTurnInProgress;
                                        const isPairNetworkActive = isLastPair && isNetworkActive;
                                        const isPairAwaitingToolApproval = isLastPair && isAwaitingToolApproval;
                                        // Use a stable key based on user message ID
                                        const key = userMessage.id;

                                        return (
                                            <Fragment key={key}>
                                                <ChatThreadListItem
                                                    index={index}
                                                    chatId={chatId}
                                                    userMessage={userMessage}
                                                    assistantMessage={assistantMessage}
                                                    isTurnInProgress={isPairTurnInProgress}
                                                    isNetworkActive={isPairNetworkActive}
                                                    isAwaitingToolApproval={isPairAwaitingToolApproval}
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
                    (!isAtBottom && isNetworkActive) && (
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
                    isTurnInProgress={isTurnInProgress}
                />
                {isOwner ? (
                    <>
                        {languageModels.length === 0 && (
                            <NotConfiguredErrorBanner className="mb-2" />
                        )}

                        <div className="border rounded-md w-full shadow-sm">
                            <CustomSlateEditor>
                                <ChatBox
                                    ref={chatBoxRef}
                                    onSubmit={onSubmit}
                                    className="min-h-[80px]"
                                    preferredSuggestionsBoxPlacement="top-start"
                                    isTurnInProgress={isTurnInProgress}
                                    isNetworkActive={isNetworkActive}
                                    onStop={stop}
                                    selectedSearchScopes={selectedSearchScopes}
                                    searchContexts={searchContexts}
                                    isDisabled={languageModels.length === 0}
                                    isAuthenticated={isAuthenticated}
                                    isLoginWallEnabled={isLoginWallEnabled}
                                    maxImageBytes={maxImageBytes}
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
                                        disabledMcpServerIds={disabledMcpServerIds}
                                        onDisabledMcpServerIdsChange={onDisabledMcpServerIdsChange}
                                        isAuthenticated={isAuthenticated}
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
        </ChatPaneDropzone>
        </McpServerIconContext.Provider>
        </ToolApprovalProvider>
    );
}
