import { AnimatedResizableHandle } from '@/components/ui/animatedResizableHandle';
import { ResizablePanelGroup } from '@/components/ui/resizable';
import { ChatSidePanel } from './components/chatSidePanel';
import { TopBar } from '../components/topBar';
import { ChatName } from './components/chatName';
import { NavigationGuardProvider } from 'next-navigation-guard';
import { getRecentChats } from '@/features/chat/actions';
import { ServiceErrorException } from '@/lib/serviceError';
import { isServiceError } from '@/lib/utils';

interface LayoutProps {
    children: React.ReactNode;
    params: {
        domain: string;
    };
}

export default async function Layout({ children, params: { domain } }: LayoutProps) {
    const chatHistory = await getRecentChats(domain);

    if (isServiceError(chatHistory)) {
        throw new ServiceErrorException(chatHistory);
    }

    return (
        // @note: we use a navigation guard here since we don't support resuming streams yet.
        // @see: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence#resuming-ongoing-streams
        <NavigationGuardProvider>
            <div className="flex flex-col h-screen w-screen">
                <TopBar
                    domain={domain}
                >
                    {/*
                        @note: since this layout is not scoped to the [id] route,
                        we cannot get the chat id in this server component. Workaround
                        here is to pass the chat history to the chat name component
                        and let it use that to get the chat name.
                     */}
                    <ChatName chatHistory={chatHistory} />
                </TopBar>
                <ResizablePanelGroup
                    direction="horizontal"
                >
                    <ChatSidePanel
                        order={1}
                        chatHistory={chatHistory}
                    />
                    <AnimatedResizableHandle />
                    {children}
                </ResizablePanelGroup>
            </div>
        </NavigationGuardProvider>
    )
}