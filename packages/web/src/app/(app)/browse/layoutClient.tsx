'use client';

import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { BottomPanel } from "./components/bottomPanel";
import { AnimatedResizableHandle } from "@/components/ui/animatedResizableHandle";
import { BrowseStateProvider } from "./browseStateProvider";
import { FileTreePanel } from "./components/fileTreePanel";
import { TopBar } from "@/app/(app)/components/topBar";
import { useBrowseParams } from "./hooks/useBrowseParams";
import { FileSearchCommandDialog } from "./components/fileSearchCommandDialog";
import { SearchBar } from "../components/searchBar";
import escapeStringRegexp from "escape-string-regexp";
import { Session } from "next-auth";

interface LayoutProps {
    children: React.ReactNode;
    session: Session | null;
    isSearchAssistSupported: boolean;
}

export function LayoutClient({
    children,
    session,
    isSearchAssistSupported,
}: LayoutProps) {
    const { repoName, revisionName, pathType } = useBrowseParams();
    return (
        <BrowseStateProvider>
            <div className="flex flex-col h-screen">
                <TopBar
                    session={session}
                >
                    <SearchBar
                        size="sm"
                        defaults={{
                            query: `repo:^${escapeStringRegexp(repoName)}$${revisionName ? ` rev:${revisionName}` : ''} `,
                        }}
                        className="w-full"
                        isSearchAssistSupported={isSearchAssistSupported}
                    />
                </TopBar>
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
                            {(pathType === 'blob' || pathType === 'tree') && (
                                <>
                                    <AnimatedResizableHandle />
                                    <BottomPanel
                                        order={2}
                                    />
                                </>
                            )}
                        </ResizablePanelGroup>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
            <FileSearchCommandDialog />
        </BrowseStateProvider>
    );
}
