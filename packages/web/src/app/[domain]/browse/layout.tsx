'use client';

import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { BottomPanel } from "./components/bottomPanel";
import { AnimatedResizableHandle } from "@/components/ui/animatedResizableHandle";
import { BrowseStateProvider } from "./browseStateProvider";
import { FileTreePanel } from "@/features/fileTree/components/fileTreePanel";
import { TopBar } from "@/app/[domain]/components/topBar";
import { Separator } from '@/components/ui/separator';
import { useBrowseParams } from "./hooks/useBrowseParams";
import { CommandDialog, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

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
            <FileSearchCommandDialog />
        </BrowseStateProvider>
    );
}

const FileSearchCommandDialog = () => {

    const [isOpen, setIsOpen] = useState(false);

    useHotkeys("mod+p", (event) => {
        event.preventDefault();
        setIsOpen((prev) => !prev);
    }, {
        enableOnFormTags: true,
        enableOnContentEditable: true,
        description: "Open File Search",
    });

    return (
        <CommandDialog
            open={isOpen}
            onOpenChange={setIsOpen}
        >
            <CommandInput placeholder="Search files..." />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandItem>Ok</CommandItem>
                <CommandItem>Letsgo</CommandItem>
            </CommandList>
        </CommandDialog>
    )
}