'use client';

import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { BottomPanel } from "./components/bottomPanel";
import { ChatPanel } from "./components/chatPanel";
import { AnimatedResizableHandle } from "@/components/ui/animatedResizableHandle";
import { BrowseStateProvider } from "./browseStateProvider";
import { FileTreePanel } from "@/features/fileTree/components/fileTreePanel";
import { TopBar } from "@/app/[domain]/components/topBar";
import { useBrowseParams } from "./hooks/useBrowseParams";
import { FileSearchCommandDialog } from "./components/fileSearchCommandDialog";
import { useDomain } from "@/hooks/useDomain";
import { SearchBar } from "../components/searchBar";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({
  children,
}: LayoutProps) {
  const { repoName, revisionName } = useBrowseParams();
  const domain = useDomain();

  return (
    <BrowseStateProvider>
      <div className="flex flex-col h-screen">
        <TopBar
          domain={domain}
        >
          <SearchBar
            size="sm"
            defaultQuery={`repo:${repoName}${revisionName ? ` rev:${revisionName}` : ''} `}
            className="w-full"
          />
        </TopBar>
        <ResizablePanelGroup
          direction="horizontal"
        >
          <FileTreePanel order={1} />

          <AnimatedResizableHandle />

          <ResizablePanel
            order={2}
            minSize={20}
            defaultSize={60}
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

          <AnimatedResizableHandle />

          <ChatPanel order={3} />
        </ResizablePanelGroup>
      </div>
      <FileSearchCommandDialog />
    </BrowseStateProvider>
  );
}
