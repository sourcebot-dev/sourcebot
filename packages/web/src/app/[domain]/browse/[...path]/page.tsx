'use client';

import { useBrowseParams } from "@/app/[domain]/browse/hooks/useBrowseParams";
import { CodePreviewPanel } from "./components/codePreviewPanel";
import { TreePreviewPanel } from "./components/treePreviewPanel";

export default function BrowsePage() {
    const { pathType } = useBrowseParams();
    return (
        <div className="flex flex-col h-full">

            {pathType === 'blob' ? (
                <CodePreviewPanel />
            ) : (
                <TreePreviewPanel />
            )}
        </div>
    )
}

