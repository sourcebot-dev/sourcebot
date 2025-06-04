'use client';

import { getTree, FileTreeNode as RawFileTreeNode } from "../actions";
import { ResizablePanel } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getIconForFile, getIconForFolder } from "vscode-icons-js";
import { Icon } from '@iconify/react';
import { useBrowseNavigation } from "@/app/[domain]/browse/hooks/useBrowseNavigation";
import { ChevronDownIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { useBrowseState } from "@/app/[domain]/browse/hooks/useBrowseState";
import { useQuery } from "@tanstack/react-query";
import { unwrapServiceError } from "@/lib/utils";
import { useDomain } from "@/hooks/useDomain";



type FileTreeNode = Omit<RawFileTreeNode, 'children'> & {
    isCollapsed: boolean;
    children: FileTreeNode[];
}

export const FileTreePanel = () => {
    const { state: { repoName, revisionName } } = useBrowseState();
    const domain = useDomain();

    const { data, isPending, isError } = useQuery({
        queryKey: ['tree', repoName, revisionName],
        queryFn: () => unwrapServiceError(getTree(repoName, revisionName, domain)),
    });

    if (isPending) {
        return <p>Loading...</p>
    }

    if (isError) {
        return <p>Error</p>
    }

    return (
        <PureFileTreePanel
            tree={data.tree}
            repoName={repoName}
            revisionName={revisionName}
        />
    )
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
}

const PureFileTreePanel = ({ tree: _tree, repoName, revisionName }: PureFileTreePanelProps) => {
    const [tree, setTree] = useState<FileTreeNode>(buildCollapsableTree(_tree));

    const setIsCollapsed = useCallback((path: string, isCollapsed: boolean) => {
        setTree(transformTree(tree, (currentNode) => {
            if (currentNode.path === path) {
                currentNode.isCollapsed = isCollapsed;
            }
            return currentNode;
        }));
    }, [tree]);

    const { navigateToPath } = useBrowseNavigation();

    const renderTree = useCallback((nodes: FileTreeNode, depth = 0) => {
        console.log('rendering tree');
        return (
            <div>
                {nodes.children.map((node) => {
                    return (
                        <>
                           <div 
                                className="flex flex-row gap-1 items-center hover:bg-accent hover:text-accent-foreground rounded-sm cursor-pointer"
                                style={{ paddingLeft: `${depth * 16}px` }}
                                onClick={() => {
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
                                }}
                            >
                                <FileTreeItem
                                    key={node.path}
                                    node={node}
                                    onClick={() => {}}
                                />
                            </div>
                            {node.children.length > 0 && !node.isCollapsed && renderTree(node, depth + 1)}
                        </>
                    );
                })}
            </div>
        );
    }, []);

    const renderedTree = useMemo(() => renderTree(tree), [tree, renderTree]);

    return (
        <ScrollArea className="h-full">
            {renderedTree}
        </ScrollArea>
    )
}

const FileTreeItem = ({
    node,
    onClick,
}: {
    node: FileTreeNode,
    onClick: () => void
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
    }, [node.type]);

    return (
        <div className="flex flex-row gap-1 select-none" onClick={onClick}>
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
            <span className="text-sm text-muted-foreground">{node.name}</span>
        </div>
    )
}
