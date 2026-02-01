'use client';

import { useBrowseParams } from "@/app/[domain]/browse/hooks/useBrowseParams";
import { useBrowseState } from "@/app/[domain]/browse/hooks/useBrowseState";
import { getTree } from "@/app/api/(client)/client";
import { KeyboardShortcutHint } from "@/app/components/keyboardShortcutHint";
import { Button } from "@/components/ui/button";
import { ResizablePanel } from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { measure, unwrapServiceError } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import { FolderOpen } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import {
    GoSidebarExpand as CollapseIcon,
    GoSidebarCollapse as ExpandIcon
} from "react-icons/go";
import { ImperativePanelHandle } from "react-resizable-panels";
import { FileTreeNode } from "../types";
import { PureFileTreePanel } from "./pureFileTreePanel";

interface FileTreePanelProps {
    order: number;
}

const FILE_TREE_PANEL_DEFAULT_SIZE = 20;
const FILE_TREE_PANEL_MIN_SIZE = 10;
const FILE_TREE_PANEL_MAX_SIZE = 30;

export const FileTreePanel = ({ order }: FileTreePanelProps) => {
    const {
        state: {
            isFileTreePanelCollapsed,
        },
        updateBrowseState,
    } = useBrowseState();

    const { repoName, revisionName, path, pathType } = useBrowseParams();
    const [openPaths, setOpenPaths] = useState<Set<string>>(new Set());
    const captureEvent = useCaptureEvent();

    const fileTreePanelRef = useRef<ImperativePanelHandle>(null);

    const { data, isError, isPending } = useQuery({
        queryKey: ['tree', repoName, revisionName, ...Array.from(openPaths)],
        queryFn: async () => {
            const result = await measure(async () => unwrapServiceError(
                getTree({
                    repoName,
                    revisionName: revisionName ?? 'HEAD',
                    paths: Array.from(openPaths),
                })
            ), 'getTree');
            
            captureEvent('wa_file_tree_loaded', {
                durationMs: result.durationMs,
            });

            return result.data;
        },
        // The tree changes only when the query key changes (repo/revision/openPaths),
        // so we can treat it as perpetually fresh and avoid background refetches.
        staleTime: Infinity,
        // Reuse the last tree during refetches (openPaths changes) to avoid UI flicker.
        placeholderData: (previousData) => previousData,
    });

    // Whenever the repo name or revision name changes, we will need to
    // reset the open paths since they no longer reference the same repository/revision.
    useEffect(() => {
        setOpenPaths(new Set());
    }, [repoName, revisionName]);

    // When the path changes (e.g., the user clicks a reference in the explore panel),
    // we want this to be open and visible in the file tree.
    useEffect(() => {
        let pathParts = path.split('/').filter(Boolean);

        // If the path is a blob, we want to open the parent directory.
        if (pathType === 'blob') {
            pathParts = pathParts.slice(0, -1);
        }

        setOpenPaths(current => {
            const next = new Set<string>(current);
            for (let i = 0; i < pathParts.length; i++) {
                next.add(pathParts.slice(0, i + 1).join('/'));
            }
            return next;
        });
    }, [path, pathType]);

    // When the user clicks a file tree node, we will want to either
    // add or remove it from the open paths depending on if it's already open or not.
    const onTreeNodeClicked = useCallback((node: FileTreeNode) => {
        if (!openPaths.has(node.path)) {
            setOpenPaths(current => {
                const next = new Set(current);
                next.add(node.path);
                return next;
            })
        } else {
            setOpenPaths(current => {
                const next = new Set(current);
                next.delete(node.path);
                return next;
            })
        }
    }, [openPaths]);

    useHotkeys("mod+b", () => {
        if (isFileTreePanelCollapsed) {
            fileTreePanelRef.current?.expand();
        } else {
            fileTreePanelRef.current?.collapse();
        }
    }, {
        enableOnFormTags: true,
        enableOnContentEditable: true,
        description: "Toggle file tree panel",
    });

    return (
        <>
            <ResizablePanel
                ref={fileTreePanelRef}
                order={order}
                minSize={FILE_TREE_PANEL_MIN_SIZE}
                maxSize={FILE_TREE_PANEL_MAX_SIZE}
                defaultSize={isFileTreePanelCollapsed ? 0 : FILE_TREE_PANEL_DEFAULT_SIZE}
                collapsible={true}
                id="file-tree-panel"
                onCollapse={() => updateBrowseState({ isFileTreePanelCollapsed: true })}
                onExpand={() => updateBrowseState({ isFileTreePanelCollapsed: false })}
            >
                <div className="flex flex-col h-full">
                    <div className="flex flex-row items-center p-2 gap-2">
                        <Tooltip
                            delayDuration={100}
                        >
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => {
                                        fileTreePanelRef.current?.collapse();
                                    }}
                                >
                                    <CollapseIcon className="w-4 h-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="flex flex-row items-center gap-2">
                                <KeyboardShortcutHint shortcut="mod+b" />
                                <Separator orientation="vertical" className="h-4" />
                                <span>Close file tree</span>
                            </TooltipContent>
                        </Tooltip>
                        <p className="font-medium">File Tree</p>
                        <Tooltip delayDuration={100}>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 ml-auto"
                                    onClick={() => {
                                        updateBrowseState({ isFileSearchOpen: true });
                                    }}
                                >
                                    <SearchIcon className="w-4 h-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="flex flex-row items-center gap-2">
                                <KeyboardShortcutHint shortcut="mod+p" />
                                <Separator orientation="vertical" className="h-4" />
                                <span>Search files</span>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    <Separator orientation="horizontal" className="w-full mb-2" />
                    {isPending ? (
                        <FileTreePanelSkeleton />
                    ) :
                        isError ? (
                            <div className="flex flex-col items-center justify-center h-full">
                                <p>Error loading file tree</p>
                            </div>
                        ) : !data.tree.children || data.tree.children.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-4">
                                <FolderOpen className="w-12 h-12 mb-3" />
                                <p className="text-sm font-medium">No files yet</p>
                                <p className="text-xs mt-1 text-center">This repository doesn&apos;t have any code yet</p>
                            </div>
                        ) : (
                            <PureFileTreePanel
                                tree={data.tree}
                                openPaths={openPaths}
                                path={path}
                                onTreeNodeClicked={onTreeNodeClicked}
                            />
                        )}
                </div>
            </ResizablePanel>
            {isFileTreePanelCollapsed && (
                <div className="flex flex-col items-center h-full p-2">
                    <Tooltip
                        delayDuration={100}
                    >
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                    fileTreePanelRef.current?.expand();
                                }}
                            >
                                <ExpandIcon className="w-4 h-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="flex flex-row items-center gap-2">
                            <KeyboardShortcutHint shortcut="mod+b" />
                            <Separator orientation="vertical" className="h-4" />
                            <span>Open file tree</span>
                        </TooltipContent>
                    </Tooltip>
                </div>
            )}
        </>
    )
}


const FileTreePanelSkeleton = () => {
    return (
        <div className="p-2 space-y-2">
            {/* Root level items */}
            <div className="flex items-center gap-2">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex items-center gap-2">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-20" />
            </div>
            <div className="flex items-center gap-2 pl-4">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-28" />
            </div>
            <div className="flex items-center gap-2 pl-4">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex items-center gap-2">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex items-center gap-2 pl-4">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex items-center gap-2 pl-8">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-20" />
            </div>
            <div className="flex items-center gap-2 pl-8">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-28" />
            </div>
            <div className="flex items-center gap-2 pl-4">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex items-center gap-2">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-28" />
            </div>
            <div className="flex items-center gap-2 pl-4">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-20" />
            </div>
            <div className="flex items-center gap-2 pl-4">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex items-center gap-2 pl-8">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex items-center gap-2 pl-8">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex items-center gap-2 pl-8">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-28" />
            </div>
            <div className="flex items-center gap-2">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-20" />
            </div>
            <div className="flex items-center gap-2 pl-4">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex items-center gap-2 pl-4">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex items-center gap-2">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex items-center gap-2 pl-4">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-20" />
            </div>
            <div className="flex items-center gap-2 pl-4">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-28" />
            </div>
            <div className="flex items-center gap-2 pl-8">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex items-center gap-2 pl-8">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-28" />
            </div>
            <div className="flex items-center gap-2 pl-12">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-20" />
            </div>
            <div className="flex items-center gap-2 pl-12">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex items-center gap-2 pl-8">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex items-center gap-2">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex items-center gap-2">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex items-center gap-2 pl-4">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex items-center gap-2 pl-4">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-28" />
            </div>
        </div>
    )
}
