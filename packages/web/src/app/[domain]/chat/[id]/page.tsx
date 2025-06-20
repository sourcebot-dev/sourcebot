import { loadChat } from '../chatStore';
import Chat from '../components/chat';
import { CreateMessage } from 'ai';
import { notFound } from 'next/navigation';

interface PageProps {
    params: {
        domain: string;
        id: string;
    },
    searchParams: {
        message?: string;
    }
}

export default async function Page({ params: { id }, searchParams: { message } }: PageProps) {
    let inputMessage: CreateMessage | undefined;

    if (message) {
        try {
            inputMessage = JSON.parse(message) as CreateMessage;
        } catch {
            notFound();
        }
    }

    const messages = await loadChat(id);

    return <Chat
        id={id}
        initialMessages={messages}
        inputMessage={inputMessage}
    />;
}