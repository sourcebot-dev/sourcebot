'use client';

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { CodePreview } from "./codePreview";
import { BottomPanel } from "./bottomPanel";
import { useState } from "react";

interface WorkbenchProps {
    repo: {
        name: string;
    },
    file: {
        path: string;
        source: string;
        language: string;
        revision: string;
    }
}

export const Workbench = ({
    repo,
    file,
}: WorkbenchProps) => {

    const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

    return (
        <ResizablePanelGroup
            direction="vertical"
        >
            <ResizablePanel
                minSize={10}
            >
                <CodePreview
                    source={file.source}
                    language={file.language}
                    repoName={repo.name}
                    path={file.path}
                    revisionName={file.revision}
                    onFindReferences={(symbol) => setSelectedSymbol(symbol)}
                />
            </ResizablePanel>
            <ResizableHandle />
            <BottomPanel
                selectedSymbol={selectedSymbol}
                repoName={repo.name}
            />
        </ResizablePanelGroup>
    )
}