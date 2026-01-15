'use client';

import { useBrowseParams } from "@/app/[domain]/browse/hooks/useBrowseParams";
import { useBrowseState } from "@/app/[domain]/browse/hooks/useBrowseState";
import { getFolderContents, getTree } from "@/app/api/(client)/client";
import { KeyboardShortcutHint } from "@/app/components/keyboardShortcutHint";
import { Button } from "@/components/ui/button";
import { ResizablePanel } from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { unwrapServiceError } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import {
    GoSidebarExpand as CollapseIcon,
    GoSidebarCollapse as ExpandIcon
} from "react-icons/go";
import { ImperativePanelHandle } from "react-resizable-panels";
import { PureFileTreePanel } from "./pureFileTreePanel";
import { FileTreeNode } from "../types";

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

    const { repoName, revisionName, path } = useBrowseParams();

    const [tree, setTree] = useState<FileTreeNode | null>(null);

    const fileTreePanelRef = useRef<ImperativePanelHandle>(null);
    const loadFolderContents = useCallback(async (folderPath: string) => {
        return unwrapServiceError(
            getFolderContents({
                repoName,
                revisionName: revisionName ?? 'HEAD',
                path: folderPath
            })
        );
    }, [repoName, revisionName]);

    const { data, isError } = useQuery({
        queryKey: ['tree', repoName, revisionName, path],
        queryFn: () => unwrapServiceError(
            getTree({
                repoName,
                revisionName: revisionName ?? 'HEAD',
                path
            })
        ),
    });

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

    useEffect(() => {
        if (!data) {
            return;
        }
        setTree(data.tree);
    }, [data]);

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
                                <KeyboardShortcutHint shortcut="⌘ B" />
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
                                <KeyboardShortcutHint shortcut="⌘ P" />
                                <Separator orientation="vertical" className="h-4" />
                                <span>Search files</span>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    <Separator orientation="horizontal" className="w-full mb-2" />
                    {!tree ? (
                        <FileTreePanelSkeleton />
                    ) :
                        isError ? (
                            <div className="flex flex-col items-center justify-center h-full">
                                <p>Error loading file tree</p>
                            </div>
                        ) : (
                            <PureFileTreePanel
                                tree={tree}
                                path={path}
                                onLoadChildren={loadFolderContents}
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
                            <KeyboardShortcutHint shortcut="⌘ B" />
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