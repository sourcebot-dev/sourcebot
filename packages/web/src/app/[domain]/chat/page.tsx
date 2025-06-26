import { redirect } from 'next/navigation';
import { createChat } from '@/features/chat/chatStore';
import { createPathWithQueryParams } from '@/lib/utils';

interface PageProps {
    params: {
        domain: string;
    },
    searchParams: {
        message?: string;
    }
}

export default async function Page({ params: { domain }, searchParams: { message } }: PageProps) {

    const id = await createChat(); // create a new chat

    const url = createPathWithQueryParams(`/${domain}/chat/${id}`,
        ["message", message ?? null],
    );

    redirect(url);
}