'use client';

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { FileCode, Loader2 } from "lucide-react";
import Link from "next/link";
import { formatAuthorsText, getCommitAuthors } from "../../../components/commitAuthors";
import { AuthorsAvatarGroup } from "../../../components/commitParts";
import { getBrowsePath } from "../../../hooks/utils";
import { CommitHashLine } from "./commitHashLine";
import { CommitMessage } from "./commitMessage";
import { computeTotalChangeCounts, DiffStat } from "./diffStat";
import { FileDiffList } from "./fileDiffList";
import { useCommitDiff } from "./useCommitDiff";

interface FullCommitDiffPanelProps {
    repoName: string;
    commitSha: string;
}

export const FullCommitDiffPanel = ({ repoName, commitSha }: FullCommitDiffPanelProps) => {
    const { data, isPending, error } = useCommitDiff({ repoName, commitSha });

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

    const baseSha = commitResponse.parents.length > 0 ? commitResponse.parents[0] : null;
    const subject = commitResponse.message.split('\n')[0];
    const formattedDate = format(new Date(commitResponse.date), 'MMM d, yyyy');
    const totalChangeCounts = computeTotalChangeCounts(diffResponse.files);
    const authors = getCommitAuthors(commitResponse);

    return (
        <div className="flex flex-col h-full">
            <div className="flex flex-col gap-2 p-3 border-b shrink-0">
                <div className="flex flex-row items-start gap-2">
                    <div className="flex-1 min-w-0">
                        <CommitMessage subject={subject} body={commitResponse.body} />
                    </div>
                    <Tooltip key={commitSha}>
                        <TooltipTrigger>
                            <Button asChild variant="outline" size="sm" className="flex-shrink-0">
                                <Link
                                    href={getBrowsePath({
                                        repoName,
                                        revisionName: commitResponse.hash,
                                        path: '',
                                        pathType: 'tree',
                                    })}
                                >
                                    <FileCode className="h-4 w-4 mr-1" />
                                    Browse files
                                </Link>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>View code at this commit</TooltipContent>
                    </Tooltip>
                </div>
                <div className="flex flex-row items-center gap-2 text-sm text-muted-foreground">
                    <AuthorsAvatarGroup authors={authors} />
                    <span
                        className="font-medium text-foreground"
                        title={authors.map((a) => a.name).join(", ")}
                    >
                        {formatAuthorsText(authors)}
                    </span>
                    <span>committed on {formattedDate}</span>
                </div>
                <CommitHashLine
                    repoName={repoName}
                    commitHash={commitResponse.hash}
                    parents={commitResponse.parents}
                />
            </div>
            <div className="flex flex-row items-center justify-between gap-2 px-4 py-2 border-b shrink-0">
                <h2 className="text-sm font-medium">
                    {diffResponse.files.length} file{diffResponse.files.length > 1 ? 's' : ''} changed
                </h2>
                <DiffStat {...totalChangeCounts} />
            </div>
            {diffResponse.files.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No files changed.</div>
            ) : (
                <FileDiffList
                    files={diffResponse.files}
                    repoName={repoName}
                    commitSha={commitSha}
                    parentSha={baseSha}
                />
            )}
        </div>
    );
};
