import { PathHeader } from "@/app/(app)/components/pathHeader";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { truncateSha } from "@/lib/utils";
import { FileQuestion, X } from "lucide-react";
import Link from "next/link";
import { getBrowsePath } from "../../../hooks/utils";
import type { CodeHostType } from "@sourcebot/db";

interface FileNotFoundPanelProps {
    path: string;
    repoName: string;
    browseRevisionName?: string;
    missingRevisionName?: string;
    previewRef?: string;
    repo: {
        codeHostType: CodeHostType;
        displayName?: string;
        externalWebUrl?: string;
    };
}

export const FileNotFoundPanel = ({
    path,
    repoName,
    browseRevisionName,
    missingRevisionName,
    previewRef,
    repo,
}: FileNotFoundPanelProps) => {
    return (
        <>
            <div className="flex flex-row py-1 px-2 items-center justify-between">
                <PathHeader
                    path={path}
                    repo={{
                        name: repoName,
                        codeHostType: repo.codeHostType,
                        displayName: repo.displayName,
                        externalWebUrl: repo.externalWebUrl,
                    }}
                    revisionName={browseRevisionName}
                />
            </div>
            <Separator />
            {previewRef && (
                <div className="flex flex-row items-center justify-between gap-2 px-4 py-2 border-b shrink-0">
                    <span className="text-sm">
                        Previewing file at revision{" "}
                        <Link
                            href={getBrowsePath({
                                repoName,
                                revisionName: browseRevisionName,
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
                        <TooltipTrigger asChild>
                            <Button
                                asChild
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground"
                            >
                                <Link
                                    href={getBrowsePath({
                                        repoName,
                                        revisionName: browseRevisionName,
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
            <div className="flex min-h-72 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                    <FileQuestion className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                    <h2 className="text-lg font-semibold">File not found</h2>
                    <p className="max-w-xl text-sm text-muted-foreground">
                        The path <span className="font-mono text-foreground">{path}</span> does not exist
                        {missingRevisionName ? <> at <span className="font-mono text-foreground">{missingRevisionName}</span></> : null}.
                    </p>
                </div>
                <Button asChild variant="outline">
                    <Link
                        href={getBrowsePath({
                            repoName,
                            revisionName: browseRevisionName,
                            path: '',
                            pathType: 'tree',
                        })}
                    >
                        Return to repository root
                    </Link>
                </Button>
            </div>
        </>
    );
}
