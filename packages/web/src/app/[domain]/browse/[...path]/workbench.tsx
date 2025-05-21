'use client';

import { ResizableHandle, ResizablePanelGroup } from "@/components/ui/resizable";
import { CodePreviewPanel } from "./components/codePreviewPanel";
import { BottomPanel } from "./components/bottomPanel";
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
            <CodePreviewPanel
                source={file.source}
                language={file.language}
                repoName={repo.name}
                path={file.path}
                revisionName={file.revision}
                onFindReferences={(symbol) => setSelectedSymbol(symbol)}
            />
            <ResizableHandle />
            <BottomPanel
                selectedSymbol={selectedSymbol}
                repoName={repo.name}
            />
        </ResizablePanelGroup>
    )
}