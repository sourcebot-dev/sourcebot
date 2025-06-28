import { redirect } from 'next/navigation';
import { createPathWithQueryParams, isServiceError } from '@/lib/utils';
import { SET_CHAT_STATE_QUERY_PARAM } from '@/features/chat/types';
import { createChat } from '@/features/chat/actions';
import { ServiceErrorException } from '@/lib/serviceError';

interface PageProps {
    params: {
        domain: string;
    },
    searchParams: {
        [SET_CHAT_STATE_QUERY_PARAM]: string | undefined;
    }
}

export default async function Page({ params: { domain }, searchParams: { [SET_CHAT_STATE_QUERY_PARAM]: setChatState } }: PageProps) {
    const response = await createChat(domain); // create a new chat

    if (isServiceError(response)) {
        throw new ServiceErrorException(response);
    }

    const url = createPathWithQueryParams(`/${domain}/chat/${response.id}`,
        [SET_CHAT_STATE_QUERY_PARAM, setChatState ?? null],
    );

    redirect(url);
}