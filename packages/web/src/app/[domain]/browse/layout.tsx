'use client';

import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { BottomPanel } from "./components/bottomPanel";
import { AnimatedResizableHandle } from "@/components/ui/animatedResizableHandle";
import { BrowseStateProvider } from "./browseStateProvider";
import { FileTreePanel } from "@/features/fileTree/components/fileTreePanel";
import { TopBar } from "@/app/[domain]/components/topBar";
import { Separator } from '@/components/ui/separator';
import { useBrowseParams } from "./hooks/useBrowseParams";
import { FileSearchCommandDialog } from "@/app/[domain]/components/fileSearchCommandDialog";
import { useBrowseState } from "./hooks/useBrowseState";
import { useDomain } from "@/hooks/useDomain";
import { useBrowseNavigation } from "./hooks/useBrowseNavigation";

interface LayoutProps {
    children: React.ReactNode;
}

export default function Layout({
    children,
}: LayoutProps) {
    return (
        <BrowseStateProvider>
            <InnerLayout>
                {children}
            </InnerLayout>
        </BrowseStateProvider>
    );
}

export const InnerLayout = ({
    children
}: LayoutProps) => {
    const { repoName, revisionName } = useBrowseParams();
    const { state: { isFileSearchOpen }, updateBrowseState } = useBrowseState();
    const { navigateToPath } = useBrowseNavigation();
    const domain = useDomain();

    return (
        <>
            <div className="flex flex-col h-screen">
                <div className='sticky top-0 left-0 right-0 z-10'>
                    <TopBar
                        defaultSearchQuery={`repo:${repoName}${revisionName ? ` rev:${revisionName}` : ''} `}
                        domain={domain}
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
                                {children}
                            </ResizablePanel>
                            <AnimatedResizableHandle />
                            <BottomPanel
                                order={2}
                            />
                        </ResizablePanelGroup>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
            <FileSearchCommandDialog
                repoName={repoName}
                revisionName={revisionName}
                isOpen={isFileSearchOpen}
                onOpenChange={(isOpen) => {
                    updateBrowseState({
                        isFileSearchOpen: isOpen,
                    });
                }}
                onSelect={(file) => {
                    navigateToPath({
                        repoName,
                        revisionName,
                        path: file.path,
                        pathType: 'blob',
                    });
                }}
            />
        </>
    )
}
