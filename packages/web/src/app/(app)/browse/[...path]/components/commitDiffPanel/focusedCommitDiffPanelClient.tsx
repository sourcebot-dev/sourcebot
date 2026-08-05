'use client';

import { PathHeader } from "@/app/(app)/components/pathHeader";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format, formatDistanceToNow } from "date-fns";
import { Loader2, X } from "lucide-react";
import Link from "next/link";
import { ComponentProps } from "react";
import { formatAuthorsText, getCommitAuthors } from "../../../components/commitAuthors";
import { AuthorsAvatarGroup } from "../../../components/commitParts";
import { getBrowsePath } from "../../../hooks/utils";
import { computeChangeCounts, DiffStat } from "./diffStat";
import { FileStatus, getFileStatus, StatusBadge } from "./fileStatus";
import { LightweightDiffViewer } from "./lightweightDiffViewer";
import { useCommitDiff } from "./useCommitDiff";

const FILE_STATUS_LABELS: Record<FileStatus, string> = {
    added: 'Added',
    modified: 'Modified',
    deleted: 'Deleted',
    renamed: 'Renamed',
};

interface FocusedCommitDiffPanelClientProps {
    repoName: string;
    revisionName?: string;
    commitSha: string;
    path: string;
    repo: ComponentProps<typeof PathHeader>['repo'];
}

export const FocusedCommitDiffPanelClient = ({
    repoName,
    revisionName,
    commitSha,
    path,
    repo,
}: FocusedCommitDiffPanelClientProps) => {
    const { data, isPending, error } = useCommitDiff({ repoName, commitSha, path });

    if (isPending) {
        return (
            <div className="flex flex-col w-full min-h-full items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-6 text-sm text-destructive">
                {error instanceof Error ? error.message : 'Error loading commit'}
            </div>
        );
    }

    const { commit: commitResponse, diff: diffResponse } = data;

    // Match by either side so deletions (oldPath === path, newPath === null)
    // and renames (oldPath !== newPath) both resolve to the right entry.
    const file = diffResponse.files.find(
        (f) => f.newPath === path || f.oldPath === path,
    );

    const authors = getCommitAuthors(commitResponse);
    const commitDate = new Date(commitResponse.date);
    const relativeDate = formatDistanceToNow(commitDate, { addSuffix: true });
    const absoluteDate = format(commitDate, 'PPpp');

    return (
        <div className="flex flex-col h-full">
            <div className="flex flex-row py-1 px-2 items-center border-b shrink-0">
                <PathHeader
                    path={path}
                    pathType="blob"
                    repo={repo}
                    revisionName={revisionName}
                />
            </div>
            {file ? (
                <>
                    <div className="flex flex-row items-center justify-between gap-2 px-4 py-2 border-b shrink-0">
                        <div className="flex flex-row items-center gap-2">
                            <StatusBadge status={getFileStatus(file)} />
                            <h2 className="text-sm font-medium">
                                {FILE_STATUS_LABELS[getFileStatus(file)]}
                            </h2>
                            <span className="text-sm text-muted-foreground">by</span>
                            <AuthorsAvatarGroup authors={authors} />
                            <span
                                className="text-sm font-medium"
                                title={authors.map((a) => a.name).join(", ")}
                            >
                                {formatAuthorsText(authors)}
                            </span>
                            <span
                                className="text-sm text-muted-foreground"
                                title={absoluteDate}
                            >
                                {relativeDate}
                            </span>
                            <span className="text-muted-foreground">·</span>
                            <Link
                                href={getBrowsePath({
                                    repoName,
                                    revisionName,
                                    path: '',
                                    pathType: 'commit',
                                    commitSha,
                                })}
                                className="text-sm text-link hover:underline"
                            >
                                View full commit
                            </Link>
                        </div>
                        <div className="flex flex-row items-center gap-2">
                            <DiffStat {...computeChangeCounts(file)} />
                            <Tooltip key={commitSha}>
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
                                            aria-label="Exit diff view"
                                        >
                                            <X className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Exit diff view</TooltipContent>
                            </Tooltip>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto">
                        <LightweightDiffViewer
                            hunks={file.hunks}
                            oldPath={file.oldPath}
                            newPath={file.newPath}
                        />
                    </div>
                </>
            ) : (
                <div className="p-4 text-sm text-muted-foreground">
                    This file was not modified in this commit.
                </div>
            )}
        </div>
    );
};
