'use client';

import { ResizablePanel } from '@/components/ui/resizable';
import { ChatThread } from '@/features/chat/components/chatThread';
import { LanguageModelInfo, SBChatMessage, SET_CHAT_STATE_QUERY_PARAM, SetChatStatePayload } from '@/features/chat/types';
import { RepositoryQuery, SearchContextQuery } from '@/lib/types';
import { CreateUIMessage } from 'ai';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useChatId } from '../../useChatId';
import { ContextItem } from '@/features/chat/components/chatBox/contextSelector';

interface ChatThreadPanelProps {
    languageModels: LanguageModelInfo[];
    repos: RepositoryQuery[];
    searchContexts: SearchContextQuery[];
    order: number;
    messages: SBChatMessage[];
    isChatReadonly: boolean;
}

export const ChatThreadPanel = ({
    languageModels,
    repos,
    searchContexts,
    order,
    messages,
    isChatReadonly,
}: ChatThreadPanelProps) => {
    // @note: we are guaranteed to have a chatId because this component will only be
    // mounted when on a /chat/[id] route.
    const chatId = useChatId()!;
    const router = useRouter();
    const searchParams = useSearchParams();
    const [inputMessage, setInputMessage] = useState<CreateUIMessage<SBChatMessage> | undefined>(undefined);

    // Use the last user's last message to determine what repos and contexts we should select by default.
    const lastUserMessage = messages.findLast((message) => message.role === "user");
    const defaultSelectedRepos = lastUserMessage?.metadata?.selectedRepos ?? [];
    const defaultSelectedContexts = lastUserMessage?.metadata?.selectedContexts ?? [];
    
    const [selectedItems, setSelectedItems] = useState<ContextItem[]>([
        ...defaultSelectedRepos.map(repoName => {
            const repoInfo = repos.find(r => r.repoName === repoName);
            return {
                type: 'repo' as const,
                value: repoName,
                name: repoInfo?.repoDisplayName || repoName.split('/').pop() || repoName,
                codeHostType: repoInfo?.codeHostType
            };
        }),
        ...defaultSelectedContexts.map(context => ({ type: 'context' as const, value: context, name: context }))
    ]);

    useEffect(() => {
        const setChatState = searchParams.get(SET_CHAT_STATE_QUERY_PARAM);
        if (!setChatState) {
            return;
        }

        try {
            const { inputMessage, selectedRepos, selectedContexts } = JSON.parse(setChatState) as SetChatStatePayload;
            setInputMessage(inputMessage);
            setSelectedItems([
                ...selectedRepos.map(repoName => {
                    const repoInfo = repos.find(r => r.repoName === repoName);
                    return {
                        type: 'repo' as const,
                        value: repoName,
                        name: repoInfo?.repoDisplayName || repoName.split('/').pop() || repoName,
                        codeHostType: repoInfo?.codeHostType
                    };
                }),
                ...(selectedContexts || []).map(context => ({ type: 'context' as const, value: context, name: context }))
            ]);
        } catch {
            console.error('Invalid message in URL');
        }

        // Remove the message from the URL
        const newSearchParams = new URLSearchParams(searchParams.toString());
        newSearchParams.delete(SET_CHAT_STATE_QUERY_PARAM);
        router.replace(`?${newSearchParams.toString()}`, { scroll: false });
    }, [searchParams, router, repos]);

    return (
        <ResizablePanel
            order={order}
            id="chat-thread-panel"
            defaultSize={85}
        >
            <div className="flex flex-col h-full w-full">
                <ChatThread
                    id={chatId}
                    initialMessages={messages}
                    inputMessage={inputMessage}
                    languageModels={languageModels}
                    repos={repos}
                    searchContexts={searchContexts}
                    selectedItems={selectedItems}
                    onSelectedItemsChange={setSelectedItems}
                    isChatReadonly={isChatReadonly}
                />
            </div>
        </ResizablePanel>
    )
}