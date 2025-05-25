import { ResizablePanelGroup } from "@/components/ui/resizable";
import { BottomPanel } from "./components/bottomPanel";
import { BrowseStateProvider } from "./browseStateProvider";
import { AnimatedResizableHandle } from "@/components/ui/animatedResizableHandle";

interface LayoutProps {
    children: React.ReactNode;
}

export default function Layout({
    children,
}: LayoutProps) {
    return (
        <BrowseStateProvider>
            <div className="flex flex-col h-screen">
                <ResizablePanelGroup
                    direction="vertical"
                >
                    {children}
                    <AnimatedResizableHandle />
                    <BottomPanel />
                </ResizablePanelGroup>
            </div>
        </BrowseStateProvider>
    );
}