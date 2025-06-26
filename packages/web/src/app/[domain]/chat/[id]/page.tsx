'use client';

import { loadChat } from '@/features/chat/chatStore';
import { ChatThread } from '@/features/chat/components/chatThread';
import { useParams } from 'next/navigation';
import { TopBar } from '../../components/topBar';
import { Separator } from '@/components/ui/separator';
import { useDomain } from '@/hooks/useDomain';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CreateMessage } from 'ai';
import { SET_CHAT_STATE_QUERY_PARAM, SetChatStatePayload } from '@/features/chat/types';

export default function Page() {
    const { id } = useParams<{ id: string }>();
    const domain = useDomain();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [inputMessage, setInputMessage] = useState<CreateMessage | undefined>(undefined);
    const [defaultSelectedRepos, setDefaultSelectedRepos] = useState<string[]>([]);

    const { data: messages, isPending, isError } = useQuery({
        queryKey: ['load-chat', id],
        queryFn: () => loadChat(id),
    });

    useEffect(() => {
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
    }, [searchParams, router]);

    return (
        <div className="flex flex-col h-screen">
            <div className='sticky top-0 left-0 right-0 z-10'>
                <TopBar
                    domain={domain}
                />
                <Separator />
            </div>
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
                />
            )}
        </div>
    )
}