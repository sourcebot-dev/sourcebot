'use client';

import { useRef } from "react";
import { FileTreeItemComponent } from "@/app/(app)/browse/components/fileTreeItemComponent";
import { getBrowsePath } from "@/app/(app)/browse/hooks/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBrowseParams } from "@/app/(app)/browse/hooks/useBrowseParams";
import { FileTreeItem } from "@/features/git";

interface PureTreePreviewPanelProps {
    items: FileTreeItem[];
}

export const PureTreePreviewPanel = ({ items }: PureTreePreviewPanelProps) => {
    const { repoName, revisionName } = useBrowseParams();
    const scrollAreaRef = useRef<HTMLDivElement>(null);
   
    return (
        <ScrollArea
            className="flex flex-col p-0.5"
            ref={scrollAreaRef}
        >
            {items.length === 0 ? (
                // We can't tell from `[]` alone whether the directory
                // is empty or the path doesn't exist in this revision
                // (git ls-tree returns empty output for both cases). The
                // message is intentionally ambiguous — the user can
                // verify the path by looking at the repo on the code
                // host. Bugbot finding on PR #1531.
                <div className="p-4 text-sm text-muted-foreground">
                    This path has no contents in this revision.
                </div>
            ) : (
                items.map((item) => (
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
                        })}
                    />
                ))
            )}
        </ScrollArea>
    )
}