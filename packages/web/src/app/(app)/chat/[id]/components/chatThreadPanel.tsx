'use client';

import { ChatThread } from '@/features/chat/components/chatThread';
import { LanguageModelInfo, SBChatMessage, SearchScope, SetChatStatePayload } from '@/features/chat/types';
import { SELECTED_SEARCH_SCOPES_LOCAL_STORAGE_KEY, SET_CHAT_STATE_SESSION_STORAGE_KEY } from '@/features/chat/constants';
import { RepositoryQuery, SearchContextQuery } from '@/lib/types';
import { CreateUIMessage } from 'ai';
import { useEffect, useState } from 'react';
import { useChatId } from '../../useChatId';
import { useSessionStorage } from 'usehooks-ts';

interface ChatThreadPanelProps {
    languageModels: LanguageModelInfo[];
    repos: RepositoryQuery[];
    searchContexts: SearchContextQuery[];
    messages: SBChatMessage[];
    isOwner: boolean;
    isAuthenticated: boolean;
    chatName?: string;
}

export const ChatThreadPanel = ({
    languageModels,
    repos,
    searchContexts,
    messages,
    isOwner,
    isAuthenticated,
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
    
    // Use the last user's last message to determine what repos and contexts we should select by default.
    const lastUserMessage = messages.findLast((message) => message.role === "user");
    const defaultSelectedSearchScopes = lastUserMessage?.metadata?.selectedSearchScopes ?? [];
    const [selectedSearchScopes, setSelectedSearchScopes] = useState<SearchScope[]>(defaultSelectedSearchScopes);
    
    useEffect(() => {
        if (!chatState) {
            return;
        }

        try {
            setInputMessage(chatState.inputMessage);
            setSelectedSearchScopes(chatState.selectedSearchScopes);
        } catch {
            console.error('Invalid chat state in session storage');
        } finally {
            setChatState(null);
        }

    }, [chatState, setChatState]);

    return (
        <div className="flex flex-col h-full w-full">
            <ChatThread
                id={chatId}
                initialMessages={messages}
                inputMessage={inputMessage}
                languageModels={languageModels}
                repos={repos}
                searchContexts={searchContexts}
                selectedSearchScopes={selectedSearchScopes}
                onSelectedSearchScopesChange={setSelectedSearchScopes}
                isOwner={isOwner}
                isAuthenticated={isAuthenticated}
                chatName={chatName}
            />
        </div>
    )
}