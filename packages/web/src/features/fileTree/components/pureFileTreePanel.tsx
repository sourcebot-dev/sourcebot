'use client';

import { FileTreeNode } from "../types";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import React, { useCallback, useMemo, useRef } from "react";
import { FileTreeItemComponent } from "./fileTreeItemComponent";
import { getBrowsePath } from "@/app/[domain]/browse/hooks/utils";
import { useBrowseParams } from "@/app/[domain]/browse/hooks/useBrowseParams";
import { useDomain } from "@/hooks/useDomain";

const renderLoadingSkeleton = (depth: number) => {
    return (
        <div className="flex items-center gap-1 p-0.5 text-sm text-muted-foreground" style={{ paddingLeft: `${depth * 16}px` }}>
            <div className="w-5 h-4" />
            <div className="h-3 w-3 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
            <span>Loading...</span>
        </div>
    );
}

interface PureFileTreePanelProps {
    tree: FileTreeNode;
    openPaths: Set<string>;
    path: string;
    onTreeNodeClicked: (node: FileTreeNode) => void;
}

export const PureFileTreePanel = ({ tree, openPaths, path, onTreeNodeClicked }: PureFileTreePanelProps) => {
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const { repoName, revisionName } = useBrowseParams();
    const domain = useDomain();

    const renderTree = useCallback((nodes: FileTreeNode, depth = 0): React.ReactNode => {
        return (
            <>
                {nodes.children.map((node) => {
                    return (
                        <React.Fragment key={node.path}>
                            <FileTreeItemComponent
                                href={getBrowsePath({
                                    repoName,
                                    revisionName,
                                    path: node.path,
                                    pathType: node.type === 'tree' ? 'tree' : 'blob',
                                    domain,
                                })}
                                key={node.path}
                                node={node}
                                isActive={node.path === path}
                                depth={depth}
                                isCollapsed={!openPaths.has(node.path)}
                                isCollapseChevronVisible={node.type === 'tree'}
                                // Only collapse the tree when a regular click happens.
                                // (i.e., not ctrl/cmd click).
                                onClick={(e) => {
                                    const isMetaOrCtrlKey = e.metaKey || e.ctrlKey;
                                    if (node.type === 'tree' && !isMetaOrCtrlKey) {
                                        onTreeNodeClicked(node);
                                    }
                                }}
                                // @note: onNavigate _won't_ be called when the user ctrl/cmd clicks on a tree node.
                                // So when a regular click happens, we want to prevent the navigation from happening
                                // and instead collapse the tree.
                                onNavigate={(e) => {
                                    if (node.type === 'tree') {
                                        e.preventDefault();
                                    }
                                }}
                                parentRef={scrollAreaRef}
                            />
                            {node.type === 'tree' && node.children.length > 0 && openPaths.has(node.path) && renderTree(node, depth + 1)}
                            {/*
                                @note: a empty tree indicates that the contents are beaing loaded. Render a loading skeleton to indicate that.
                                This relies on the fact that you cannot have empty tress in git.
                                @see: https://archive.kernel.org/oldwiki/git.wiki.kernel.org/index.php/GitFaq.html#Can_I_add_empty_directories.3F
                            */}
                            {node.type === 'tree' && node.children.length === 0 && openPaths.has(node.path) && renderLoadingSkeleton(depth)}
                        </React.Fragment>
                    );
                })}
            </>
        );
    }, [domain, onTreeNodeClicked, path, repoName, revisionName, openPaths]);

    const renderedTree = useMemo(() => renderTree(tree), [tree, renderTree]);

    return (
        <ScrollArea
            className="h-full w-full overflow-auto p-0.5"
            ref={scrollAreaRef}
        >
            {renderedTree}
            <ScrollBar orientation="horizontal" />
        </ScrollArea>
    )
}

