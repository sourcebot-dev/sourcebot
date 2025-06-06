'use client';

import { Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { getRepoInfoByName } from "@/actions";
import { FileHeader } from "@/app/[domain]/components/fileHeader";
import { useCallback } from "react";
import { FileTreeItem, getFolderContents } from "@/features/fileTree/actions";
import { FileTreeItemComponent } from "@/features/fileTree/components/fileTreeItemComponent";
import { useBrowseNavigation } from "../../hooks/useBrowseNavigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { unwrapServiceError } from "@/lib/utils";
import { useBrowseParams } from "../../hooks/useBrowseParams";
import { useDomain } from "@/hooks/useDomain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getFileSource } from "@/features/search/fileSourceApi";

export const TreePreviewPanel = () => {
    const { path } = useBrowseParams();
    const { repoName, revisionName } = useBrowseParams();
    const domain = useDomain();
    const queryClient = useQueryClient();
    const { navigateToPath } = useBrowseNavigation();

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
            queryClient.prefetchQuery({
                queryKey: ['fileSource', repoName, revisionName, node.path, domain],
                queryFn: () => unwrapServiceError(getFileSource({
                    fileName: node.path,
                    repository: repoName,
                    branch: revisionName,
                }, domain)),
            });
        } else if (node.type === 'tree') {
            queryClient.prefetchQuery({
                queryKey: ['tree', repoName, revisionName, node.path, domain],
                queryFn: () => unwrapServiceError(
                    getFolderContents({
                        repoName,
                        revisionName: revisionName ?? 'HEAD',
                        path: node.path,
                    }, domain)
                ),
            });
        }

    }, [queryClient, repoName, revisionName, domain]);

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
                <FileHeader
                    fileName={path}
                    repo={{
                        name: repoName,
                        codeHostType: repoInfoResponse.codeHostType,
                        displayName: repoInfoResponse.displayName,
                        webUrl: repoInfoResponse.webUrl,
                    }}
                />
            </div>
            <Separator />
            <ScrollArea className="flex flex-col p-0.5">
                {data.map((item) => (
                    <FileTreeItemComponent
                        key={item.path}
                        node={item}
                        isActive={false}
                        depth={0}
                        isCollapseChevronVisible={false}
                        onClick={() => onNodeClicked(item)}
                        onMouseEnter={() => onNodeMouseEnter(item)}
                    />
                ))}
            </ScrollArea>
        </>
    )
}