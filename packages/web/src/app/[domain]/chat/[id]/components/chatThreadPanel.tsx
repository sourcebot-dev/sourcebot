'use client';

import { ResizablePanel } from '@/components/ui/resizable';
import { ChatThread } from '@/features/chat/components/chatThread';
import { LanguageModelInfo, SBChatMessage, SET_CHAT_STATE_QUERY_PARAM, SetChatStatePayload } from '@/features/chat/types';
import { RepositoryQuery } from '@/lib/types';
import { CreateUIMessage } from 'ai';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useChatId } from '../../useChatId';

interface ChatThreadPanelProps {
    languageModels: LanguageModelInfo[];
    repos: RepositoryQuery[];
    order: number;
    messages: SBChatMessage[];
    isChatReadonly: boolean;
}

export const ChatThreadPanel = ({
    languageModels,
    repos,
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
    const [selectedRepos, setSelectedRepos] = useState<string[]>([]);

    useEffect(() => {
        const setChatState = searchParams.get(SET_CHAT_STATE_QUERY_PARAM);
        if (!setChatState) {
            return;
        }

        try {
            const { inputMessage, selectedRepos } = JSON.parse(setChatState) as SetChatStatePayload;
            setInputMessage(inputMessage);
            setSelectedRepos(selectedRepos);
        } catch {
            console.error('Invalid message in URL');
        }

        // Remove the message from the URL
        const newSearchParams = new URLSearchParams(searchParams.toString());
        newSearchParams.delete(SET_CHAT_STATE_QUERY_PARAM);
        router.replace(`?${newSearchParams.toString()}`, { scroll: false });
    }, [searchParams, router]);

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
                    selectedRepos={selectedRepos}
                    onSelectedReposChange={setSelectedRepos}
                    isChatReadonly={isChatReadonly}
                />
            </div>
        </ResizablePanel>
    )
}