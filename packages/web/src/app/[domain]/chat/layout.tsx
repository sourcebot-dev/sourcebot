
import { AnimatedResizableHandle } from '@/components/ui/animatedResizableHandle';
import { ResizablePanelGroup } from '@/components/ui/resizable';
import { Separator } from '@/components/ui/separator';
import { TopBar } from '../components/topBar';
import { ChatSidePanel } from './components/chatSidePanel';

interface LayoutProps {
    children: React.ReactNode;
    params: {
        domain: string;
    }
}

export default function Layout({ children, params: { domain } }: LayoutProps) {
    return (
        <div className="flex flex-col h-screen w-screen">
            <div className='sticky top-0 left-0 right-0 z-10'>
                <TopBar
                    domain={domain}
                />
                <Separator />
            </div>
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