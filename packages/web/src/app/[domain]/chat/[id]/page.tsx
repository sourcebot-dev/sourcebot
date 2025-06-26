import { loadChat } from '@/features/chat/chatStore';
import { ChatThread } from '@/features/chat/components/chatThread';
import { CreateMessage } from 'ai';
import { notFound } from 'next/navigation';
import { TopBar } from '../../components/topBar';
import { Separator } from '@/components/ui/separator';

interface PageProps {
    params: {
        domain: string;
        id: string;
    },
    searchParams: {
        message?: string;
    }
}

export default async function Page({ params: { id, domain }, searchParams: { message } }: PageProps) {
    let inputMessage: CreateMessage | undefined;

    if (message) {
        try {
            inputMessage = JSON.parse(message) as CreateMessage;
        } catch {
            notFound();
        }
    }

    const messages = await loadChat(id);

    return (
        <div className="flex flex-col h-screen">
            <div className='sticky top-0 left-0 right-0 z-10'>
                <TopBar
                    domain={domain}
                />
                <Separator />
            </div>
            <ChatThread
                id={id}
                initialMessages={messages}
                inputMessage={inputMessage}
            />
        </div>
    )
}