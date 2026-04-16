'use client';

import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { BottomPanel } from "./components/bottomPanel";
import { AnimatedResizableHandle } from "@/components/ui/animatedResizableHandle";
import { BrowseStateProvider } from "./browseStateProvider";
import { FileTreePanel } from "./components/fileTreePanel";
import { useBrowseParams } from "./hooks/useBrowseParams";
import { FileSearchCommandDialog } from "./components/fileSearchCommandDialog";
import { SearchBar } from "../components/searchBar";
import escapeStringRegexp from "escape-string-regexp";
import { Separator } from "@/components/ui/separator";

interface LayoutProps {
    children: React.ReactNode;
    isSearchAssistSupported: boolean;
}

export function LayoutClient({
    children,
    isSearchAssistSupported,
}: LayoutProps) {
    const { repoName, revisionName } = useBrowseParams();
    return (
        <BrowseStateProvider>
            <div className="flex flex-col h-full">
                <div className='sticky top-0 left-0 right-0 z-10'>
                    <div className="py-1.5 px-3">
                        <SearchBar
                            size="sm"
                            defaults={{
                                query: `repo:^${escapeStringRegexp(repoName)}$${revisionName ? ` rev:${revisionName}` : ''} `,
                            }}
                            className="w-full"
                            isSearchAssistSupported={isSearchAssistSupported}
                        />
                    </div>
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
            <FileSearchCommandDialog />
        </BrowseStateProvider>
    );
}
