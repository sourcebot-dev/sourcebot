'use client';

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { History } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Commit } from "@/features/git";
import { getBrowsePath } from "../../hooks/utils";
import { formatAuthorsText, getCommitAuthors } from "./commitAuthors";
import { AuthorsAvatarGroup, CommitBody, CommitBodyToggle } from "./commitParts";

interface CommitHeaderProps {
    commit: Commit;
    repoName: string;
    path: string;
    revisionName?: string;
}

export const CommitHeader = ({ commit, repoName, path, revisionName }: CommitHeaderProps) => {
    const [isBodyExpanded, setIsBodyExpanded] = useState(false);
    const shortSha = commit.hash.slice(0, 7);
    const relativeDate = formatDistanceToNow(new Date(commit.date), { addSuffix: true });
    const hasBody = commit.body.trim().length > 0;

    const historyHref = getBrowsePath({
        repoName,
        revisionName,
        path,
        pathType: 'commits',
    });

    const authors = useMemo(
        () => getCommitAuthors(commit),
        [commit],
    );

    return (
        <>
            <div className="flex flex-row py-1 px-2 items-center justify-between gap-4 min-w-0">
                <div className="flex flex-row items-center gap-2 min-w-0 overflow-hidden">
                    <AuthorsAvatarGroup authors={authors} />
                    <span className="text-sm font-medium flex-shrink-0">
                        {formatAuthorsText(authors)}
                    </span>
                    <span className="text-sm text-muted-foreground truncate" title={commit.message}>
                        {commit.message}
                    </span>
                    {hasBody && (
                        <CommitBodyToggle
                            pressed={isBodyExpanded}
                            onPressedChange={setIsBodyExpanded}
                        />
                    )}
                </div>
                <div className="flex flex-row items-center gap-3 flex-shrink-0">
                    <div className="flex flex-row items-center gap-1.5">
                        <span className="text-sm font-mono text-muted-foreground" title={commit.hash}>
                            {shortSha}
                        </span>
                        <span className="text-sm text-muted-foreground">·</span>
                        <span className="text-sm text-muted-foreground" title={commit.date}>
                            {relativeDate}
                        </span>
                    </div>
                    <Button asChild variant="ghost" size="sm" className="h-7 px-2 gap-1.5">
                        <Link href={historyHref}>
                            <History className="h-4 w-4" />
                            <span className="text-sm">History</span>
                        </Link>
                    </Button>
                </div>
            </div>
            {hasBody && isBodyExpanded && (
                <CommitBody body={commit.body} className="border-t" />
            )}
        </>
    );
};
