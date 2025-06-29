'use client';

import { ChatThread } from '@/features/chat/components/chatThread';
import { useParams } from 'next/navigation';
import { useDomain } from '@/hooks/useDomain';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CreateMessage } from 'ai';
import { ModelProviderInfo, SET_CHAT_STATE_QUERY_PARAM, SetChatStatePayload } from '@/features/chat/types';
import { loadChatMessages } from '@/features/chat/actions';
import { unwrapServiceError } from '@/lib/utils';
import { ResizablePanel } from '@/components/ui/resizable';

interface ChatThreadPanelProps {
    modelProviderInfo?: ModelProviderInfo;
    order: number;
}

export const ChatThreadPanel = ({
    modelProviderInfo,
    order,
}: ChatThreadPanelProps) => {
    const { id } = useParams<{ id: string }>();
    const domain = useDomain();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [inputMessage, setInputMessage] = useState<CreateMessage | undefined>(undefined);
    const [defaultSelectedRepos, setDefaultSelectedRepos] = useState<string[]>([]);

    const { data: messages, isPending, isError } = useQuery({
        queryKey: ['load-chat', id, domain],
        queryFn: () => unwrapServiceError(loadChatMessages({ chatId: id }, domain)),
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
            const { inputMessage, selectedRepos } = JSON.parse(setChatState) as SetChatStatePayload;
            setInputMessage(inputMessage);
            setDefaultSelectedRepos(selectedRepos);
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
                        id={id}
                        initialMessages={messages}
                        inputMessage={inputMessage}
                        defaultSelectedRepos={defaultSelectedRepos}
                        modelProviderInfo={modelProviderInfo}
                    />
                )}
            </div>
        </ResizablePanel>
    )
}