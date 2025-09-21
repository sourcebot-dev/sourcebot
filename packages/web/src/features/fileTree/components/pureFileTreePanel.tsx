'use client';

import { FileTreeNode as RawFileTreeNode } from "../actions";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import React, { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { FileTreeItemComponent } from "./fileTreeItemComponent";
import { getBrowsePath } from "@/app/[domain]/browse/hooks/useBrowseNavigation";
import { useBrowseParams } from "@/app/[domain]/browse/hooks/useBrowseParams";
import { useDomain } from "@/hooks/useDomain";

export type FileTreeNode = Omit<RawFileTreeNode, 'children'> & {
    isCollapsed: boolean;
    children: FileTreeNode[];
}

const buildCollapsibleTree = (tree: RawFileTreeNode): FileTreeNode => {
    return {
        ...tree,
        isCollapsed: true,
        children: tree.children.map(buildCollapsibleTree),
    }
}

const transformTree = (
    tree: FileTreeNode,
    transform: (node: FileTreeNode) => FileTreeNode
): FileTreeNode => {
    const newNode = transform(tree);
    const newChildren = tree.children.map(child => transformTree(child, transform));
    return {
        ...newNode,
        children: newChildren,
    }
}

interface PureFileTreePanelProps {
    tree: RawFileTreeNode;
    path: string;
}

export const PureFileTreePanel = ({ tree: _tree, path }: PureFileTreePanelProps) => {
    const [tree, setTree] = useState<FileTreeNode>(buildCollapsibleTree(_tree));
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const { repoName, revisionName } = useBrowseParams();
    const domain = useDomain();

    // @note: When `_tree` changes, it indicates that a new tree has been loaded.
    // In that case, we need to rebuild the collapsible tree.
    useEffect(() => {
        setTree(buildCollapsibleTree(_tree));
    }, [_tree]);

    const setIsCollapsed = useCallback((path: string, isCollapsed: boolean) => {
        setTree(currentTree => transformTree(currentTree, (currentNode) => {
            if (currentNode.path === path) {
                currentNode.isCollapsed = isCollapsed;
            }
            return currentNode;
        }));
    }, []);

    // When the path changes, expand all the folders up to the path
    useEffect(() => {
        const pathParts = path.split('/');
        let currentPath = '';
        for (let i = 0; i < pathParts.length; i++) {
            currentPath += pathParts[i];
            setIsCollapsed(currentPath, false);
            if (i < pathParts.length - 1) {
                currentPath += '/';
            }
        }
    }, [path, setIsCollapsed]);

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
                                isCollapsed={node.isCollapsed}
                                isCollapseChevronVisible={node.type === 'tree'}
                                // Only collapse the tree when a regular click happens.
                                // (i.e., not ctrl/cmd click).
                                onClick={(e) => {
                                    const isMetaOrCtrlKey = e.metaKey || e.ctrlKey;
                                    if (node.type === 'tree' && !isMetaOrCtrlKey) {
                                        setIsCollapsed(node.path, !node.isCollapsed);
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
                            {node.children.length > 0 && !node.isCollapsed && renderTree(node, depth + 1)}
                        </React.Fragment>
                    );
                })}
            </>
        );
    }, [path]);

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

