'use client';

import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { BottomPanel } from "./components/bottomPanel";
import { AnimatedResizableHandle } from "@/components/ui/animatedResizableHandle";
import { BrowseStateProvider } from "./browseStateProvider";
import { FileTreePanel } from "@/features/fileTree/components/fileTreePanel";
import { TopBar } from "@/app/[domain]/components/topBar";
import { Separator } from '@/components/ui/separator';
import { useBrowseParams } from "./hooks/useBrowseParams";

interface LayoutProps {
    children: React.ReactNode;
    params: {
        domain: string;
    }
}

export default function Layout({
    children: codePreviewPanel,
    params,
}: LayoutProps) {
    const { repoName, revisionName } = useBrowseParams();

    return (
        <BrowseStateProvider>
            <div className="flex flex-col h-screen">
                <div className='sticky top-0 left-0 right-0 z-10'>
                    <TopBar
                        defaultSearchQuery={`repo:${repoName}${revisionName ? ` rev:${revisionName}` : ''} `}
                        domain={params.domain}
                    />
                    <Separator />
                </div>
                <ResizablePanelGroup
                    direction="horizontal"
                >
                    <FileTreePanel order={1} />

                    <AnimatedResizableHandle />

                    <ResizablePanel
                        order={2}
                        minSize={10}
                        defaultSize={80}
                        id="code-preview-panel-container"
                    >
                        <ResizablePanelGroup
                            direction="vertical"
                        >
                            <ResizablePanel
                                order={1}
                                id="code-preview-panel"
                            >
                                {codePreviewPanel}
                            </ResizablePanel>
                            <AnimatedResizableHandle />
                            <BottomPanel
                                order={2}
                            />
                        </ResizablePanelGroup>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </BrowseStateProvider>
    );
}