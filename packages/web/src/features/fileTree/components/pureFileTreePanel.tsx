'use client';

import { FileTreeItem, FileTreeNode as RawFileTreeNode } from "../types";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import React, { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { FileTreeItemComponent } from "./fileTreeItemComponent";
import { getBrowsePath } from "@/app/[domain]/browse/hooks/utils";
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

const buildTreeNodeFromItem = (item: FileTreeItem): FileTreeNode => {
    return {
        ...item,
        isCollapsed: true,
        children: [],
    };
}

const renderLoadingSkeleton = (depth: number) => {
    return (
        <div className="flex items-center gap-1 p-0.5 text-sm text-muted-foreground" style={{ paddingLeft: `${depth * 16}px` }}>
            <div className="w-5 h-4" />
            <div className="h-3 w-3 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
            <span>Loading...</span>
        </div>
    );
}

const updateTreeNode = (
    tree: FileTreeNode,
    targetPath: string,
    transform: (node: FileTreeNode) => FileTreeNode
): FileTreeNode => {
    if (tree.path === targetPath) {
        return transform(tree);
    }

    return {
        ...tree,
        children: tree.children.map(child => updateTreeNode(child, targetPath, transform)),
    };
}

const findNodeByPath = (tree: FileTreeNode, targetPath: string): FileTreeNode | null => {
    if (tree.path === targetPath) {
        return tree;
    }

    for (const child of tree.children) {
        const found = findNodeByPath(child, targetPath);
        if (found) {
            return found;
        }
    }

    return null;
}

const collectLoadedPaths = (tree: RawFileTreeNode, paths: Set<string> = new Set()): Set<string> => {
    if (tree.type === 'tree' && tree.children.length > 0) {
        paths.add(tree.path);
    }

    for (const child of tree.children) {
        collectLoadedPaths(child, paths);
    }

    return paths;
}

interface PureFileTreePanelProps {
    tree: RawFileTreeNode;
    path: string;
    onLoadChildren: (path: string) => Promise<FileTreeItem[]>;
}

export const PureFileTreePanel = ({ tree: _tree, path, onLoadChildren }: PureFileTreePanelProps) => {
    const [tree, setTree] = useState<FileTreeNode>(buildCollapsibleTree(_tree));
    const [loadedPaths, setLoadedPaths] = useState<Set<string>>(() => collectLoadedPaths(_tree));
    const [loadingPaths, setLoadingPaths] = useState<Set<string>>(() => new Set());
    const treeRef = useRef<FileTreeNode>(tree);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const { repoName, revisionName } = useBrowseParams();
    const domain = useDomain();

    // @note: When `_tree` changes, it indicates that a new tree has been loaded.
    // In that case, we need to rebuild the collapsible tree.
    useEffect(() => {
        setTree(buildCollapsibleTree(_tree));
        setLoadedPaths(collectLoadedPaths(_tree));
        setLoadingPaths(new Set());
    }, [_tree]);

    useEffect(() => {
        treeRef.current = tree;
    }, [tree]);

    const setIsCollapsed = useCallback((path: string, isCollapsed: boolean) => {
        setTree(currentTree => updateTreeNode(currentTree, path, (currentNode) => ({
            ...currentNode,
            isCollapsed,
        })));
    }, []);

    // Loads the children of a given path, if they haven't been loaded yet.
    const handleExpand = useCallback(async (targetPath: string) => {
        if (loadedPaths.has(targetPath) || loadingPaths.has(targetPath)) {
            return;
        }

        const currentNode = findNodeByPath(treeRef.current, targetPath);
        if (!currentNode || currentNode.type !== 'tree') {
            return;
        }

        setLoadingPaths(current => {
            const next = new Set(current);
            next.add(targetPath);
            return next;
        });

        try {
            const children = await onLoadChildren(targetPath);
            const childNodes = children.map(buildTreeNodeFromItem);
            setTree(currentTree => updateTreeNode(currentTree, targetPath, (node) => ({
                ...node,
                children: childNodes,
            })));
            setLoadedPaths(current => {
                const next = new Set(current);
                next.add(targetPath);
                return next;
            });
        } catch (error) {
            console.error('Failed to load folder contents.', { error, targetPath });
        } finally {
            setLoadingPaths(current => {
                const next = new Set(current);
                next.delete(targetPath);
                return next;
            });
        }
    }, [loadedPaths, loadingPaths, onLoadChildren]);

    // When the path changes, expand all the folders up to the path
    useEffect(() => {
        const pathParts = path.split('/').filter(Boolean);
        let currentPath = '';
        for (let i = 0; i < pathParts.length; i++) {
            currentPath = currentPath.length === 0 ? pathParts[i] : `${currentPath}/${pathParts[i]}`;
            setIsCollapsed(currentPath, false);
            void handleExpand(currentPath);
        }
    }, [path, setIsCollapsed, handleExpand]);

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
                                        if (node.isCollapsed) {
                                            handleExpand(node.path);
                                        }
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
                            {node.type === 'tree' && !node.isCollapsed && loadingPaths.has(node.path) && renderLoadingSkeleton(depth)}
                        </React.Fragment>
                    );
                })}
            </>
        );
    }, [domain, handleExpand, loadingPaths, path, repoName, revisionName, setIsCollapsed]);

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

