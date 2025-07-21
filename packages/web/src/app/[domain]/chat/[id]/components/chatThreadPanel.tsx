'use client';

import { ChatThread } from '@/features/chat/components/chatThread';
import { useDomain } from '@/hooks/useDomain';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LanguageModelInfo, SBChatMessage, SET_CHAT_STATE_QUERY_PARAM, SetChatStatePayload } from '@/features/chat/types';
import { loadChatMessages } from '@/features/chat/actions';
import { unwrapServiceError } from '@/lib/utils';
import { ResizablePanel } from '@/components/ui/resizable';
import { useChatId } from '../../useChatId';
import { CreateUIMessage } from 'ai';

interface ChatThreadPanelProps {
    languageModels: LanguageModelInfo[];
    order: number;
}

export const ChatThreadPanel = ({
    languageModels,
    order,
}: ChatThreadPanelProps) => {
    // @note: we are guaranteed to have a chatId because this component will only be
    // mounted when on a /chat/[id] route.
    const chatId = useChatId()!;
    const domain = useDomain();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [inputMessage, setInputMessage] = useState<CreateUIMessage<SBChatMessage> | undefined>(undefined);

    const { data: messages, isPending, isError } = useQuery({
        queryKey: ['load-chat', chatId, domain],
        queryFn: () => unwrapServiceError(loadChatMessages({ chatId }, domain)),
    });

    useEffect(() => {
        // @note: there was a bug when navigating from the home page to a chat thread with
        // the setChatState query param would cause the `isPending` flag to never be set to false.
        // The workaround was to only set the input message if the `loadChatMessages` query was not pending.
        if (isPending) {
            return;
        }

        const setChatState = searchParams.get(SET_CHAT_STATE_QUERY_PARAM);
        if (!setChatState) {
            return;
        }

        try {
            const { inputMessage } = JSON.parse(setChatState) as SetChatStatePayload;
            setInputMessage(inputMessage);
        } catch {
            console.error('Invalid message in URL');
        }

        // Remove the message from the URL
        const newSearchParams = new URLSearchParams(searchParams.toString());
        newSearchParams.delete(SET_CHAT_STATE_QUERY_PARAM);
        router.replace(`?${newSearchParams.toString()}`, { scroll: false });
    }, [searchParams, router, isPending]);

    return (
        <ResizablePanel
            order={order}
            id="chat-thread-panel"
            defaultSize={85}
        >
            <div className="flex flex-col h-full w-full">
                {isPending ? (
                    <div className="flex-1 flex flex-col items-center gap-2 justify-center text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <p>Loading chat...</p>
                    </div>
                ) : isError ? (
                    <div className="flex-1 flex items-center justify-center">
                        <p>Error loading chat</p>
                    </div>
                ) : (
                    <ChatThread
                        id={chatId}
                        initialMessages={messages}
                        inputMessage={inputMessage}
                        languageModels={languageModels}
                    />
                )}
            </div>
        </ResizablePanel>
    )
}