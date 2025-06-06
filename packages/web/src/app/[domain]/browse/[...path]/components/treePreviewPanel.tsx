'use client';

import { Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { getRepoInfoByName } from "@/actions";
import { PathHeader } from "@/app/[domain]/components/pathHeader";
import { useCallback, useRef } from "react";
import { FileTreeItem, getFolderContents } from "@/features/fileTree/actions";
import { FileTreeItemComponent } from "@/features/fileTree/components/fileTreeItemComponent";
import { useBrowseNavigation } from "../../hooks/useBrowseNavigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { unwrapServiceError } from "@/lib/utils";
import { useBrowseParams } from "../../hooks/useBrowseParams";
import { useDomain } from "@/hooks/useDomain";
import { useQuery } from "@tanstack/react-query";
import { usePrefetchFileSource } from "@/hooks/usePrefetchFileSource";
import { usePrefetchFolderContents } from "@/hooks/usePrefetchFolderContents";

export const TreePreviewPanel = () => {
    const { path } = useBrowseParams();
    const { repoName, revisionName } = useBrowseParams();
    const domain = useDomain();
    const { navigateToPath } = useBrowseNavigation();
    const { prefetchFileSource } = usePrefetchFileSource();
    const { prefetchFolderContents } = usePrefetchFolderContents();
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    const { data: repoInfoResponse, isPending: isRepoInfoPending, isError: isRepoInfoError } = useQuery({
        queryKey: ['repoInfo', repoName, domain],
        queryFn: () => unwrapServiceError(getRepoInfoByName(repoName, domain)),
    });

    const { data, isPending: isFolderContentsPending, isError: isFolderContentsError } = useQuery({
        queryKey: ['tree', repoName, revisionName, path, domain],
        queryFn: () => unwrapServiceError(
            getFolderContents({
                repoName,
                revisionName: revisionName ?? 'HEAD',
                path,
            }, domain)
        ),
    });

    const onNodeClicked = useCallback((node: FileTreeItem) => {
        navigateToPath({
            repoName: repoName,
            revisionName: revisionName,
            path: node.path,
            pathType: node.type === 'tree' ? 'tree' : 'blob',
        });
    }, [navigateToPath, repoName, revisionName]);

    const onNodeMouseEnter = useCallback((node: FileTreeItem) => {
        if (node.type === 'blob') {
            prefetchFileSource(repoName, revisionName ?? 'HEAD', node.path);
        } else if (node.type === 'tree') {
            prefetchFolderContents(repoName, revisionName ?? 'HEAD', node.path);
        }
    }, [prefetchFileSource, prefetchFolderContents, repoName, revisionName]);

    if (isFolderContentsPending || isRepoInfoPending) {
        return (
            <div className="flex flex-col w-full min-h-full items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
            </div>
        )
    }

    if (isFolderContentsError || isRepoInfoError) {
        return <div>Error loading tree</div>
    }

    return (
        <>
            <div className="flex flex-row py-1 px-2 items-center justify-between">
                <PathHeader
                    path={path}
                    repo={{
                        name: repoName,
                        codeHostType: repoInfoResponse.codeHostType,
                        displayName: repoInfoResponse.displayName,
                        webUrl: repoInfoResponse.webUrl,
                    }}
                    pathType="tree"
                />
            </div>
            <Separator />
            <ScrollArea
                className="flex flex-col p-0.5"
                ref={scrollAreaRef}
            >
                {data.map((item) => (
                    <FileTreeItemComponent
                        key={item.path}
                        node={item}
                        isActive={false}
                        depth={0}
                        isCollapseChevronVisible={false}
                        onClick={() => onNodeClicked(item)}
                        onMouseEnter={() => onNodeMouseEnter(item)}
                        parentRef={scrollAreaRef}
                    />
                ))}
            </ScrollArea>
        </>
    )
}