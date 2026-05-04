import { getRepoInfoByName } from "@/actions";
import { PathHeader } from "@/app/(app)/components/pathHeader";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, getCodeHostInfoForRepo, isServiceError, truncateSha } from "@/lib/utils";
import { X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getBrowsePath } from "../../../hooks/utils";
import { BlameAgeLegend } from "./blameAgeLegend";
import { BlameViewToggle } from "./blameViewToggle";
import { PureCodePreviewPanel } from "./pureCodePreviewPanel";
import { getFileBlame, getFileSource } from '@/features/git';

const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

interface CodePreviewPanelProps {
    path: string;
    repoName: string;
    revisionName?: string;
    // When set, the file's content is fetched at this ref while the
    // surrounding browse context (path header) stays at `revisionName`.
    previewRef?: string;
    // When true, fetch blame data alongside the file source and pass it to
    // the editor so the blame gutter can render.
    blame?: boolean;
}

export const CodePreviewPanel = async ({ path, repoName, revisionName, previewRef, blame }: CodePreviewPanelProps) => {
    const contentRef = previewRef ?? revisionName;

    const [fileSourceResponse, repoInfoResponse, blameResponse] = await Promise.all([
        getFileSource({
            path,
            repo: repoName,
            ref: contentRef,
        }, { source: 'sourcebot-web-client' }),
        getRepoInfoByName(repoName),
        blame
            ? getFileBlame({
                path,
                repo: repoName,
                ref: contentRef,
            }, { source: 'sourcebot-web-client' })
            : Promise.resolve(undefined),
    ]);

    if (isServiceError(fileSourceResponse)) {
        return <div>Error loading file source: {fileSourceResponse.message}</div>
    }

    if (isServiceError(repoInfoResponse)) {
        return <div>Error loading repo info: {repoInfoResponse.message}</div>
    }

    if (blameResponse !== undefined && isServiceError(blameResponse)) {
        return <div>Error loading blame: {blameResponse.message}</div>
    }

    const source = fileSourceResponse.source;
    const lineCount = source.length === 0
        ? 0
        : source.split('\n').length - (source.endsWith('\n') ? 1 : 0);
    const byteSize = Buffer.byteLength(source, 'utf-8');
    const fileSize = formatFileSize(byteSize);

    const codeHostInfo = getCodeHostInfoForRepo({
        codeHostType: repoInfoResponse.codeHostType,
        name: repoInfoResponse.name,
        displayName: repoInfoResponse.displayName,
        externalWebUrl: repoInfoResponse.externalWebUrl,
    });

    // @todo: this is a hack to support linking to files for ADO. ADO doesn't support web urls with HEAD so we replace it with main. THis
    // will break if the default branch is not main.
    const fileWebUrl = repoInfoResponse.codeHostType === "azuredevops" && fileSourceResponse.externalWebUrl ?
        fileSourceResponse.externalWebUrl.replace("version=GBHEAD", "version=GBmain") : fileSourceResponse.externalWebUrl;

    return (
        <>
            <div className="flex flex-row py-1 px-2 items-center justify-between">
                <PathHeader
                    path={path}
                    repo={{
                        name: repoName,
                        codeHostType: repoInfoResponse.codeHostType,
                        displayName: repoInfoResponse.displayName,
                        externalWebUrl: repoInfoResponse.externalWebUrl,
                    }}
                    revisionName={contentRef}
                />

                {fileWebUrl && (

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
                )}
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
                    <span className="text-sm text-muted-foreground">
                        {lineCount.toLocaleString()} lines · {fileSize}
                    </span>
                    {blame && (
                        <>
                            <Separator orientation="vertical" className="h-4" />
                            <BlameAgeLegend />
                        </>
                    )}
                </div>
            )}
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
                blame={blameResponse}
            />
        </>
    )
}