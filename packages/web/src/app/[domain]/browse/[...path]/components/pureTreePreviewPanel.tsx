'use client';

import { useCallback, useRef } from "react";
import { FileTreeItem } from "@/features/fileTree/actions";
import { FileTreeItemComponent } from "@/features/fileTree/components/fileTreeItemComponent";
import { useBrowseNavigation } from "../../hooks/useBrowseNavigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBrowseParams } from "../../hooks/useBrowseParams";

interface PureTreePreviewPanelProps {
    items: FileTreeItem[];
}

export const PureTreePreviewPanel = ({ items }: PureTreePreviewPanelProps) => {
    const { repoName, revisionName } = useBrowseParams();
    const { navigateToPath } = useBrowseNavigation();
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    const onNodeClicked = useCallback((node: FileTreeItem) => {
        navigateToPath({
            repoName: repoName,
            revisionName: revisionName,
            path: node.path,
            pathType: node.type === 'tree' ? 'tree' : 'blob',
        });
    }, [navigateToPath, repoName, revisionName]);

    return (
        <ScrollArea
            className="flex flex-col p-0.5"
            ref={scrollAreaRef}
        >
            {items.map((item) => (
                <FileTreeItemComponent
                    key={item.path}
                    node={item}
                    isActive={false}
                    depth={0}
                    isCollapseChevronVisible={false}
                    onClick={() => onNodeClicked(item)}
                    parentRef={scrollAreaRef}
                />
            ))}
        </ScrollArea>
    )
}