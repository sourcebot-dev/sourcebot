'use client';

import { useCallback, useRef } from "react";
import { FileTreeItem } from "@/features/fileTree/actions";
import { FileTreeItemComponent } from "@/features/fileTree/components/fileTreeItemComponent";
import { useBrowseNavigation } from "../../hooks/useBrowseNavigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBrowseParams } from "../../hooks/useBrowseParams";
import { usePrefetchFileSource } from "@/hooks/usePrefetchFileSource";
import { usePrefetchFolderContents } from "@/hooks/usePrefetchFolderContents";

interface PureTreePreviewPanelProps {
    items: FileTreeItem[];
}

export const PureTreePreviewPanel = ({ items }: PureTreePreviewPanelProps) => {
    const { repoName, revisionName } = useBrowseParams();
    const { navigateToPath } = useBrowseNavigation();
    const { prefetchFileSource } = usePrefetchFileSource();
    const { prefetchFolderContents } = usePrefetchFolderContents();
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    const onNodeClicked = useCallback((node: FileTreeItem) => {
        navigateToPath({
            repoName: repoName,
            revisionName: revisionName,
            path: node.path,
            pathType: node.type === 'tree' ? 'tree' : 'blob',
        });
    }, [navigateToPath, repoName, revisionName]);

    const onNodeMouseEnter = useCallback((node: FileTreeItem) => {
        if (node.type === 'blob') {
            prefetchFileSource(repoName, revisionName ?? 'HEAD', node.path);
        } else if (node.type === 'tree') {
            prefetchFolderContents(repoName, revisionName ?? 'HEAD', node.path);
        }
    }, [prefetchFileSource, prefetchFolderContents, repoName, revisionName]);

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
                    onMouseEnter={() => onNodeMouseEnter(item)}
                    parentRef={scrollAreaRef}
                />
            ))}
        </ScrollArea>
    )
}