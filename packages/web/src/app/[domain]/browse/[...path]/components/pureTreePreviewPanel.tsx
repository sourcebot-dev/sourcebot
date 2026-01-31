'use client';

import { useRef } from "react";
import { FileTreeItemComponent } from "@/app/[domain]/browse/components/fileTreeItemComponent";
import { getBrowsePath } from "../../hooks/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBrowseParams } from "../../hooks/useBrowseParams";
import { useDomain } from "@/hooks/useDomain";
import { FileTreeItem } from "@/features/git";

interface PureTreePreviewPanelProps {
    items: FileTreeItem[];
}

export const PureTreePreviewPanel = ({ items }: PureTreePreviewPanelProps) => {
    const { repoName, revisionName } = useBrowseParams();
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const domain = useDomain();
   
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
                    parentRef={scrollAreaRef}
                    href={getBrowsePath({
                        repoName,
                        revisionName,
                        path: item.path,
                        pathType: item.type === 'tree' ? 'tree' : 'blob',
                        domain,
                    })}
                />
            ))}
        </ScrollArea>
    )
}