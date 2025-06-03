'use client';

import { FileTreeNode as RawFileTreeNode } from "../actions";
import { ResizablePanel } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getIconForFile, getIconForFolder } from "vscode-icons-js";
import { Icon } from '@iconify/react';
import { useBrowseNavigation } from "@/app/[domain]/browse/hooks/useBrowseNavigation";
import { ChevronDownIcon, ChevronRightIcon } from "@radix-ui/react-icons";

interface FileTreePanelProps {
    tree: RawFileTreeNode;
    path: string;
    repoName: string;
    revisionName: string;
}

type FileTreeNode = Omit<RawFileTreeNode, 'children'> & {
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

export const FileTreePanel = ({ tree: _tree, path, repoName, revisionName }: FileTreePanelProps) => {

    const [tree, setTree] = useState<FileTreeNode>(buildCollapsableTree(_tree));

    const setIsCollapsed = useCallback((path: string, isCollapsed: boolean) => {
        setTree(transformTree(tree, (currentNode) => {
            if (currentNode.path === path) {
                currentNode.isCollapsed = isCollapsed;
            }
            return currentNode;
        }));
    }, [tree]);

    useEffect(() => {
        const parts = path.split('/');
        let currentPath = '';
        parts.forEach((part) => {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            console.log('setting collapse for', currentPath);
            setIsCollapsed(currentPath, false);
        });
    }, [path]);

    const { navigateToPath } = useBrowseNavigation();

    const renderTree = useCallback((nodes: FileTreeNode, depth = 0) => {
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
        <ResizablePanel
            order={1}
        >
            <ScrollArea className="h-full">
                {renderedTree}
            </ScrollArea>
        </ResizablePanel>
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
