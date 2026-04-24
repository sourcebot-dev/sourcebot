'use client';

import { useCallback, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Code, FileCode } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CopyIconButton } from "@/app/(app)/components/copyIconButton";
import { useToast } from "@/components/hooks/use-toast";
import type { Commit } from "@/features/git";
import { getBrowsePath } from "../../hooks/utils";
import { formatAuthorsText, getCommitAuthors } from "./commitAuthors";
import { AuthorsAvatarGroup, CommitBody, CommitBodyToggle } from "./commitParts";

interface CommitRowProps {
    commit: Commit;
    repoName: string;
    path: string;
}

export const CommitRow = ({ commit, repoName, path }: CommitRowProps) => {
    const [isBodyExpanded, setIsBodyExpanded] = useState(false);
    const { toast } = useToast();

    const shortSha = commit.hash.slice(0, 7);
    const relativeDate = formatDistanceToNow(new Date(commit.date), { addSuffix: true });
    const hasBody = commit.body.trim().length > 0;
    const hasFilePath = path !== '' && path !== '/';

    const authors = useMemo(
        () => getCommitAuthors(commit),
        [commit],
    );

    const viewFileAtCommitHref = getBrowsePath({
        repoName,
        revisionName: commit.hash,
        path,
        pathType: 'blob',
    });

    const viewRepoAtCommitHref = getBrowsePath({
        repoName,
        revisionName: commit.hash,
        path: '',
        pathType: 'tree',
    });

    const onCopySha = useCallback(() => {
        navigator.clipboard.writeText(commit.hash);
        toast({ description: "✅ Copied commit SHA to clipboard" });
        return true;
    }, [commit.hash, toast]);

    return (
        <>
            <div className="flex flex-row py-3 px-3 items-center justify-between gap-4 min-w-0 border-b">
                <div className="flex flex-col gap-1 min-w-0 overflow-hidden">
                    <div className="flex flex-row items-center gap-2 min-w-0 overflow-hidden">
                        <span className="text-sm font-medium truncate" title={commit.message}>
                            {commit.message}
                        </span>
                        {hasBody && (
                            <CommitBodyToggle
                                pressed={isBodyExpanded}
                                onPressedChange={setIsBodyExpanded}
                            />
                        )}
                    </div>
                    <div className="flex flex-row items-center gap-2 min-w-0 overflow-hidden">
                        <AuthorsAvatarGroup authors={authors} />
                        <span className="text-sm text-muted-foreground truncate">
                            {formatAuthorsText(authors)} authored {relativeDate}
                        </span>
                    </div>
                </div>
                <div className="flex flex-row items-center gap-1 flex-shrink-0">
                    <span className="text-sm font-mono text-muted-foreground" title={commit.hash}>
                        {shortSha}
                    </span>
                    <CopyIconButton onCopy={onCopySha} />
                    {hasFilePath && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button asChild variant="ghost" size="sm" className="h-6 w-6 text-muted-foreground">
                                    <Link href={viewFileAtCommitHref} aria-label="View code at this commit">
                                        <FileCode className="h-3 w-3" />
                                    </Link>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>View code at this commit</TooltipContent>
                        </Tooltip>
                    )}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button asChild variant="ghost" size="sm" className="h-6 w-6 text-muted-foreground">
                                <Link href={viewRepoAtCommitHref} aria-label="View repository at this commit">
                                    <Code className="h-3 w-3" />
                                </Link>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>View repository at this commit</TooltipContent>
                    </Tooltip>
                </div>
            </div>
            {hasBody && isBodyExpanded && (
                <CommitBody body={commit.body} className="border-b" />
            )}
        </>
    );
};
