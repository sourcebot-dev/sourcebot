'use client';

import { ChatThread } from '@/ee/features/chat/components/chatThread';
import { LanguageModelInfo, SBChatMessage, SearchScope, SetChatStatePayload } from '@/features/chat/types';
import { SELECTED_SEARCH_SCOPES_LOCAL_STORAGE_KEY, SET_CHAT_STATE_SESSION_STORAGE_KEY } from '@/features/chat/constants';
import { RepositoryQuery, SearchContextQuery } from '@/lib/types';
import { CreateUIMessage } from 'ai';
import { useEffect, useState } from 'react';
import { useChatId } from '@/app/(app)/chat/useChatId';
import { useSessionStorage } from 'usehooks-ts';

interface ChatThreadPanelProps {
    languageModels: LanguageModelInfo[];
    repos: RepositoryQuery[];
    searchContexts: SearchContextQuery[];
    messages: SBChatMessage[];
    isOwner: boolean;
    isAuthenticated: boolean;
    isLoginWallEnabled: boolean;
    maxImageBytes: number;
    maxPdfBytes: number;
    chatName?: string;
}

const normalizeDisabledMcpServerIds = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((id): id is string => typeof id === 'string');
}

export const ChatThreadPanel = ({
    languageModels,
    repos,
    searchContexts,
    messages,
    isOwner,
    isAuthenticated,
    isLoginWallEnabled,
    maxImageBytes,
    maxPdfBytes,
    chatName,
}: ChatThreadPanelProps) => {
    // @note: we are guaranteed to have a chatId because this component will only be
    // mounted when on a /chat/[id] route.
    const chatId = useChatId()!;
    const [inputMessage, setInputMessage] = useState<CreateUIMessage<SBChatMessage> | undefined>(undefined);
    const [chatState, setChatState] = useSessionStorage<SetChatStatePayload | null>(SET_CHAT_STATE_SESSION_STORAGE_KEY, null);

    // Clear the landing page's persisted search scope selection so that returning
    // to the landing page to start a new thread starts with a clean state.
    useEffect(() => {
        localStorage.removeItem(SELECTED_SEARCH_SCOPES_LOCAL_STORAGE_KEY);
    }, []);
    
    // Use the last user message to determine what repos, contexts, and MCP state we should select by default.
    const lastUserMessage = messages.findLast((message) => message.role === "user");
    const defaultSelectedSearchScopes = lastUserMessage?.metadata?.selectedSearchScopes ?? [];
    const defaultDisabledMcpServerIds = normalizeDisabledMcpServerIds(lastUserMessage?.metadata?.disabledMcpServerIds);
    const [selectedSearchScopes, setSelectedSearchScopes] = useState<SearchScope[]>(defaultSelectedSearchScopes);
    const [disabledMcpServerIds, setDisabledMcpServerIds] = useState<string[]>(defaultDisabledMcpServerIds);

    useEffect(() => {
        if (!chatState) {
            return;
        }

        try {
            setInputMessage(chatState.inputMessage);
            setSelectedSearchScopes(chatState.selectedSearchScopes);
            setDisabledMcpServerIds(normalizeDisabledMcpServerIds(chatState.disabledMcpServerIds));
        } catch {
            console.error('Invalid chat state in session storage');
        } finally {
            setChatState(null);
        }

    }, [chatState, setChatState]);

    return (
        <div className="flex flex-col flex-1 min-h-0 w-full">
            <ChatThread
                id={chatId}
                initialMessages={messages}
                inputMessage={inputMessage}
                languageModels={languageModels}
                repos={repos}
                searchContexts={searchContexts}
                selectedSearchScopes={selectedSearchScopes}
                onSelectedSearchScopesChange={setSelectedSearchScopes}
                disabledMcpServerIds={disabledMcpServerIds}
                onDisabledMcpServerIdsChange={setDisabledMcpServerIds}
                isOwner={isOwner}
                isAuthenticated={isAuthenticated}
                isLoginWallEnabled={isLoginWallEnabled}
                maxImageBytes={maxImageBytes}
                maxPdfBytes={maxPdfBytes}
                chatName={chatName}
            />
        </div>
    )
}
