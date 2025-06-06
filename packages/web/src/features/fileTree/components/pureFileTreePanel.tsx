'use client';

import { FileTreeNode as RawFileTreeNode } from "../actions";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { FileTreeItemComponent } from "./fileTreeItemComponent";
import { useBrowseNavigation } from "@/app/[domain]/browse/hooks/useBrowseNavigation";
import { useBrowseParams } from "@/app/[domain]/browse/hooks/useBrowseParams";
import { useQueryClient } from "@tanstack/react-query";
import { useDomain } from "@/hooks/useDomain";
import { unwrapServiceError } from "@/lib/utils";
import { getFileSource } from "@/features/search/fileSourceApi";


export type FileTreeNode = Omit<RawFileTreeNode, 'children'> & {
    isCollapsed: boolean;
    children: FileTreeNode[];
}

const buildCollapsableTree = (tree: RawFileTreeNode): FileTreeNode => {
    return {
        ...tree,
        isCollapsed: true,
        children: tree.children.map(buildCollapsableTree),
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
    const [tree, setTree] = useState<FileTreeNode>(buildCollapsableTree(_tree));
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const { navigateToPath } = useBrowseNavigation();
    const { repoName, revisionName } = useBrowseParams();
    const queryClient = useQueryClient();
    const domain = useDomain();

    // @note: When `_tree` changes, it indicates that a new tree has been loaded.
    // In that case, we need to rebuild the collapsable tree.
    useEffect(() => {
        setTree(buildCollapsableTree(_tree));
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

    const onNodeClicked = useCallback((node: FileTreeNode) => {
        if (node.type === 'tree') {
            setIsCollapsed(node.path, !node.isCollapsed);
        }
        else if (node.type === 'blob') {
            navigateToPath({
                repoName: repoName,
                revisionName: revisionName,
                path: node.path,
                pathType: 'blob',
            });

        }
    }, [setIsCollapsed, navigateToPath, repoName, revisionName]);

    // @note: We prefetch the file source when the user hovers over a file.
    // This is to try and mitigate having a loading spinner appear when
    // the user clicks on a file to open it.
    // @see: /browse/[...path]/page.tsx
    const onNodeMouseEnter = useCallback((node: FileTreeNode) => {
        if (node.type !== 'blob') {
            return;
        }

        queryClient.prefetchQuery({
            queryKey: ['fileSource', repoName, revisionName, node.path, domain],
            queryFn: () => unwrapServiceError(getFileSource({
                fileName: node.path,
                repository: repoName,
                branch: revisionName,
            }, domain)),
        });

    }, [queryClient, repoName, revisionName, domain]);

    const renderTree = useCallback((nodes: FileTreeNode, depth = 0) => {
        return (
            <div>
                {nodes.children.map((node) => {
                    return (
                        <div key={node.path}>
                            <FileTreeItemComponent
                                node={node}
                                isActive={node.path === path}
                                depth={depth}
                                isCollapsed={node.isCollapsed}
                                isCollapseChevronVisible={node.type === 'tree'}
                                onClick={() => onNodeClicked(node)}
                                onMouseEnter={() => onNodeMouseEnter(node)}
                            />
                            {node.children.length > 0 && !node.isCollapsed && renderTree(node, depth + 1)}
                        </div>
                    );
                })}
            </div>
        );
    }, [path, onNodeClicked, onNodeMouseEnter]);

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

