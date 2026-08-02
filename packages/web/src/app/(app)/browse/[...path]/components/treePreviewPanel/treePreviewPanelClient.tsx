'use client';

import { getFolderContents } from "@/app/api/(client)/client";
import { PathHeader } from "@/app/(app)/components/pathHeader";
import { Separator } from "@/components/ui/separator";
import { isServiceError } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ComponentProps } from "react";
import { PureTreePreviewPanel } from "./pureTreePreviewPanel";

interface TreePreviewPanelClientProps {
    path: string;
    repoName: string;
    revisionName?: string;
    repo: ComponentProps<typeof PathHeader>['repo'];
}

export const TreePreviewPanelClient = ({ path, repoName, revisionName, repo }: TreePreviewPanelClientProps) => {
    const { data: folderContentsResponse, isPending } = useQuery({
        queryKey: ['folderContents', repoName, revisionName ?? null, path],
        queryFn: () => getFolderContents({
            repoName,
            revisionName: revisionName ?? 'HEAD',
            path,
        }),
    });

    if (isPending) {
        return (
            <div className="flex flex-col w-full min-h-full items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
            </div>
        );
    }

    if (!folderContentsResponse || isServiceError(folderContentsResponse)) {
        return <div>Error loading tree preview</div>
    }

    // Distinguish "the repository has no files" from "this sub-directory
    // has no files" at the root path. The latter is handled inside
    // `PureTreePreviewPanel` with a "This directory is empty." copy;
    // the former is a stronger message and avoids rendering a path
    // header for a non-existent root. See issue #1530.
    if (folderContentsResponse.length === 0 && path === '') {
        return (
            <div className="flex flex-col w-full min-h-full items-center justify-center gap-2 p-6 text-muted-foreground">
                <p className="text-sm font-medium">This repository is empty.</p>
                <p className="text-xs">
                    Once a commit lands on the default branch, its files will appear here.
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="flex flex-row py-1 px-2 items-center justify-between">
                <PathHeader
                    path={path}
                    repo={repo}
                    pathType="tree"
                    isFileIconVisible={false}
                    revisionName={revisionName}
                />
            </div>
            <Separator />
            <PureTreePreviewPanel items={folderContentsResponse} />
        </>
    )
}
