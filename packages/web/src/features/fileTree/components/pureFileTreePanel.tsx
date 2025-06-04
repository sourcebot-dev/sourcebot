'use client';

import { FileTreeNode as RawFileTreeNode } from "../actions";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { getIconForFile, getIconForFolder } from "vscode-icons-js";
import { Icon } from '@iconify/react';
import { useBrowseNavigation } from "@/app/[domain]/browse/hooks/useBrowseNavigation";
import { ChevronDownIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import clsx from "clsx";
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
    repoName: string;
    revisionName: string;
    path: string;
}

export const PureFileTreePanel = ({ tree: _tree, repoName, revisionName, path }: PureFileTreePanelProps) => {
    const [tree, setTree] = useState<FileTreeNode>(buildCollapsableTree(_tree));
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const queryClient = useQueryClient();
    const domain = useDomain();

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

    const { navigateToPath } = useBrowseNavigation();

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

    // When the path changes, scroll to the file in the tree
    useEffect(() => {
        const activeElement = document.querySelector(`[data-path="${path}"]`);
        if (!activeElement) {
            return;
        }

        activeElement.scrollIntoView({
            behavior: 'instant',
            block: 'nearest',
        });
    }, [path]);

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

    // Prefetch the file source when the user hovers over a file.
    // This is to try and mitigate having a loading spinner appear when the user clicks on a file
    // to open it.
    const onNodeMouseEnter = useCallback((node: FileTreeNode) => {
        if (node.type !== 'blob') {
            return;
        }

        queryClient.prefetchQuery({
            queryKey: ['fileSource', repoName, revisionName, node.path, domain],
            queryFn: () => unwrapServiceError(getFileSource({
                fileName: node.path,
                repository: repoName,
                branch: revisionName
            }, domain)),
            staleTime: Infinity,
        })

    }, [queryClient, repoName, revisionName, domain]);

    const renderTree = useCallback((nodes: FileTreeNode, depth = 0) => {
        return (
            <div>
                {nodes.children.map((node) => {
                    return (
                        <>
                            <div
                                className={clsx("flex flex-row gap-1 items-center hover:bg-accent hover:text-accent-foreground rounded-sm cursor-pointer p-0.5", {
                                    'bg-accent': node.path === path,
                                })}
                                data-path={node.path}
                                style={{ paddingLeft: `${depth * 16}px` }}
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        onNodeClicked(node);
                                    }
                                }}
                                onClick={() => onNodeClicked(node)}
                                onMouseEnter={() => onNodeMouseEnter(node)}
                            >
                                <FileTreeItem
                                    key={node.path}
                                    node={node}
                                />
                            </div>
                            {node.children.length > 0 && !node.isCollapsed && renderTree(node, depth + 1)}
                        </>
                    );
                })}
            </div>
        );
    }, [onNodeClicked, onNodeMouseEnter, path]);

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

const FileTreeItem = ({
    node,
}: {
    node: FileTreeNode,
}) => {
    const iconName = useMemo(() => {
        if (node.type === 'tree') {
            const icon = getIconForFolder(node.name);
            if (icon) {
                const iconName = `vscode-icons:${icon.substring(0, icon.indexOf('.')).replaceAll('_', '-')}`;
                return iconName;
            }
        } else if (node.type === 'blob') {
            const icon = getIconForFile(node.name);
            if (icon) {
                const iconName = `vscode-icons:${icon.substring(0, icon.indexOf('.')).replaceAll('_', '-')}`;
                return iconName;
            }
        }

        return "vscode-icons:file-type-unknown";
    }, [node.name, node.type]);

    return (
        <div
            className="flex flex-row gap-1 select-none"
        >
            <div className="flex flex-row gap-1 cursor-pointer w-4 h-4 flex-shrink-0">
                {node.type === 'tree' && (
                    node.isCollapsed ? (
                        <ChevronRightIcon className="w-4 h-4 flex-shrink-0" />
                    ) : (
                        <ChevronDownIcon className="w-4 h-4 flex-shrink-0" />
                    )
                )}
            </div>
            <Icon icon={iconName} className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{node.name}</span>
        </div>
    )
}
