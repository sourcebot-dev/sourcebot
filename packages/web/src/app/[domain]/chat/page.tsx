import { redirect } from 'next/navigation';
import { createChat } from '@/features/chat/chatStore';
import { createPathWithQueryParams } from '@/lib/utils';
import { SET_CHAT_STATE_QUERY_PARAM } from '@/features/chat/types';

interface PageProps {
    params: {
        domain: string;
    },
    searchParams: {
        [SET_CHAT_STATE_QUERY_PARAM]: string | null;
    }
}

export default async function Page({ params: { domain }, searchParams: { [SET_CHAT_STATE_QUERY_PARAM]: setChatState } }: PageProps) {
    const id = await createChat(); // create a new chat

    const url = createPathWithQueryParams(`/${domain}/chat/${id}`,
        [SET_CHAT_STATE_QUERY_PARAM, setChatState],
    );

    redirect(url);
}