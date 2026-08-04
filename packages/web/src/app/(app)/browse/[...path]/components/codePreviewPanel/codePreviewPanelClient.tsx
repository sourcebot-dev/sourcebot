'use client';

import { getFileBlame, getFileSource } from "@/app/api/(client)/client";
import { PathHeader } from "@/app/(app)/components/pathHeader";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, getCodeHostInfoForRepo, isServiceError, truncateSha } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ComponentProps } from "react";
import { getBrowsePath } from "../../../hooks/utils";
import { BlameAgeLegend } from "./blameAgeLegend";
import { BlameViewToggle } from "./blameViewToggle";
import { PureCodePreviewPanel } from "./pureCodePreviewPanel";

const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

interface CodePreviewPanelClientProps {
    path: string;
    repoName: string;
    revisionName?: string;
    previewRef?: string;
    blame?: boolean;
    repo: ComponentProps<typeof PathHeader>['repo'];
}

export const CodePreviewPanelClient = ({ path, repoName, revisionName, previewRef, blame, repo }: CodePreviewPanelClientProps) => {
    const contentRef = previewRef ?? revisionName;

    const { data: fileSourceResponse, isPending: isFileSourcePending } = useQuery({
        queryKey: ['fileSource', repoName, contentRef ?? null, path],
        queryFn: () => getFileSource({
            path,
            repo: repoName,
            ...(contentRef ? { ref: contentRef } : {}),
        }),
    });

    const { data: blameResponse, isPending: isBlamePending } = useQuery({
        queryKey: ['fileBlame', repoName, contentRef ?? null, path],
        queryFn: () => getFileBlame({
            path,
            repo: repoName,
            ...(contentRef ? { ref: contentRef } : {}),
        }),
        enabled: !!blame,
    });

    const codeHostInfo = getCodeHostInfoForRepo({
        codeHostType: repo.codeHostType,
        name: repo.name,
        displayName: repo.displayName,
        externalWebUrl: repo.externalWebUrl,
    });

    const loadedFile = fileSourceResponse && !isServiceError(fileSourceResponse) ? fileSourceResponse : undefined;

    // @todo: this is a hack to support linking to files for ADO. ADO doesn't support web urls with HEAD so we replace it with main. This
    // will break if the default branch is not main.
    const fileWebUrl = loadedFile
        ? (repo.codeHostType === "azuredevops" && loadedFile.externalWebUrl
            ? loadedFile.externalWebUrl.replace("version=GBHEAD", "version=GBmain")
            : loadedFile.externalWebUrl)
        : undefined;

    // Line/size stats are derived from the fetched file, so they only appear
    // once it has loaded. The surrounding toolbar (blame toggle) does not wait.
    const lineCount = loadedFile === undefined
        ? undefined
        : loadedFile.source.length === 0
            ? 0
            : loadedFile.source.split('\n').length - (loadedFile.source.endsWith('\n') ? 1 : 0);
    const fileSize = loadedFile === undefined
        ? undefined
        : formatFileSize(new TextEncoder().encode(loadedFile.source).length);

    // The path header and separator are derived entirely from props, so they
    // render immediately. Only the body below depends on the fetched source,
    // so the loading / error states live here rather than replacing the whole
    // panel.
    const renderBody = () => {
        if (isFileSourcePending || (blame && isBlamePending)) {
            return (
                <div className="flex flex-1 flex-col w-full items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                </div>
            );
        }

        if (!fileSourceResponse || isServiceError(fileSourceResponse)) {
            return (
                <div className="p-4 text-sm text-destructive">
                    Error loading file source: {isServiceError(fileSourceResponse) ? fileSourceResponse.message : 'No response received'}
                </div>
            );
        }

        if (blameResponse !== undefined && isServiceError(blameResponse)) {
            return (
                <div className="p-4 text-sm text-destructive">
                    Error loading blame: {blameResponse.message}
                </div>
            );
        }

        return (
            <>
                {previewRef && (
                    <div className="flex flex-row items-center justify-between gap-2 px-4 py-2 border-b shrink-0">
                        <span className="text-sm">
                            Previewing file at revision{" "}
                            <Link
                                href={getBrowsePath({
                                    repoName,
                                    revisionName,
                                    path: '',
                                    pathType: 'commit',
                                    commitSha: previewRef,
                                })}
                                className="font-mono text-link hover:underline"
                            >
                                {truncateSha(previewRef)}
                            </Link>
                        </span>
                        <Tooltip key={previewRef}>
                            <TooltipTrigger>
                                <Button
                                    asChild
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground"
                                >
                                    <Link
                                        href={getBrowsePath({
                                            repoName,
                                            revisionName,
                                            path,
                                            pathType: 'blob',
                                        })}
                                        aria-label="Close preview"
                                    >
                                        <X className="h-4 w-4" />
                                    </Link>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Close preview</TooltipContent>
                        </Tooltip>
                    </div>
                )}
                <PureCodePreviewPanel
                    source={fileSourceResponse.source}
                    language={fileSourceResponse.language}
                    repoName={repoName}
                    path={path}
                    revisionName={contentRef ?? 'HEAD'}
                    blame={blame ? blameResponse : undefined}
                />
            </>
        );
    };

    return (
        <>
            <div className="flex flex-row py-1 px-2 items-center justify-between">
                <div className="min-w-0 flex-1">
                    <PathHeader
                        path={path}
                        repo={repo}
                        revisionName={contentRef}
                    />
                </div>

                {isFileSourcePending ? (
                    <Skeleton className="h-6 w-32 mx-2 rounded-md flex-shrink-0" />
                ) : fileWebUrl ? (
                    <a
                        href={fileWebUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-row items-center gap-2 px-2 py-0.5 rounded-md flex-shrink-0"
                    >
                        <Image
                            src={codeHostInfo.icon}
                            alt={codeHostInfo.codeHostName}
                            className={cn('w-4 h-4 flex-shrink-0', codeHostInfo.iconClassName)}
                        />
                        <span className="text-sm font-medium">Open in {codeHostInfo.codeHostName}</span>
                    </a>
                ) : null}
            </div>
            <Separator />
            {!previewRef && (
                <div className="flex flex-row items-center gap-3 px-4 py-1 border-b shrink-0">
                    <BlameViewToggle
                        repoName={repoName}
                        revisionName={revisionName}
                        path={path}
                        blame={blame ?? false}
                    />
                    {isFileSourcePending ? (
                        <Skeleton className="h-4 w-32" />
                    ) : lineCount !== undefined ? (
                        <span className="text-sm text-muted-foreground">
                            {lineCount.toLocaleString()} lines · {fileSize}
                        </span>
                    ) : null}
                    {blame && (
                        <>
                            <Separator orientation="vertical" className="h-4" />
                            <BlameAgeLegend />
                        </>
                    )}
                </div>
            )}
            {renderBody()}
        </>
    )
}
