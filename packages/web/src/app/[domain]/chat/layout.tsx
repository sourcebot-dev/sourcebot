
import { AnimatedResizableHandle } from '@/components/ui/animatedResizableHandle';
import { ResizablePanelGroup } from '@/components/ui/resizable';
import { ChatSidePanel } from './components/chatSidePanel';
import { TopBar } from '../components/topBar';
import { ChatName } from './components/chatName';
import { NavigationGuardProvider } from 'next-navigation-guard';

interface LayoutProps {
    children: React.ReactNode;
    params: {
        domain: string;
    }
}

export default function Layout({ children, params: { domain } }: LayoutProps) {
    return (
        // @note: we use a navigation guard here since we don't support resuming streams yet.
        // @see: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence#resuming-ongoing-streams
        <NavigationGuardProvider>
            <div className="flex flex-col h-screen w-screen">
                <TopBar
                    domain={domain}
                >
                    <ChatName />
                </TopBar>
                <ResizablePanelGroup
                    direction="horizontal"
                >
                    <ChatSidePanel
                        order={1}
                    />
                    <AnimatedResizableHandle />
                    {children}
                </ResizablePanelGroup>
            </div>
        </NavigationGuardProvider>
    )
}