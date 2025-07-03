
import { AnimatedResizableHandle } from '@/components/ui/animatedResizableHandle';
import { ResizablePanelGroup } from '@/components/ui/resizable';
import { ChatSidePanel } from './components/chatSidePanel';
import { TopBar } from '../components/topBar';
import { ChatName } from './components/chatName';

interface LayoutProps {
    children: React.ReactNode;
    params: {
        domain: string;
    }
}

export default function Layout({ children, params: { domain } }: LayoutProps) {
    return (
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
    )
}