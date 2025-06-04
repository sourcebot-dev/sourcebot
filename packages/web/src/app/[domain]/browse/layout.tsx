'use client';

import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { BottomPanel } from "./components/bottomPanel";
import { AnimatedResizableHandle } from "@/components/ui/animatedResizableHandle";
import { BrowseStateProvider } from "./browseStateProvider";
import { FileTreePanel } from "@/features/fileTree/components/fileTreePanel";
import { TopBar } from "@/app/[domain]/components/topBar";
import { Separator } from '@/components/ui/separator';
import { notFound, usePathname } from "next/navigation";

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
    const pathname = usePathname();

    const startIndex = pathname.indexOf('/browse/');
    if (startIndex === -1) {
        return notFound();
    }

    const rawPath = pathname.substring(startIndex + '/browse/'.length);
    const sentinalIndex = rawPath.search(/\/-\/(tree|blob)\//);
    if (sentinalIndex === -1) {
        return notFound();
    }

    const repoAndRevisionName = rawPath.substring(0, sentinalIndex).split('@');
    const repoName = repoAndRevisionName[0];
    const revisionName = repoAndRevisionName.length > 1 ? repoAndRevisionName[1] : undefined;

    return (
        <BrowseStateProvider
            repoName={repoName}
            revisionName={revisionName ?? 'HEAD'}
        >
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
                        defaultSize={90}
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