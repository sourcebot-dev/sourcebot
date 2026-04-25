'use client';

import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { Code, FileCode } from "lucide-react";
import type { Commit } from "@/features/git";
import { BrowsePathType, getBrowsePath } from "../hooks/utils";
import { formatAuthorsText, getCommitAuthors } from "./commitAuthors";
import { AuthorsAvatarGroup, CommitActionLink } from "./commitParts";

interface HistoryRowProps {
    commit: Commit;
    repoName: string;
    path: string;
    pathType: BrowsePathType;
}

export const HistoryRow = ({ commit, repoName, path, pathType }: HistoryRowProps) => {
    const shortSha = commit.hash.slice(0, 7);
    const relativeDate = formatDistanceToNow(new Date(commit.date), { addSuffix: true });
    const isBlobPath = pathType === 'blob';

    const authors = useMemo(() => getCommitAuthors(commit), [commit]);

    const viewCodeHref = getBrowsePath({
        repoName,
        revisionName: commit.hash,
        path,
        pathType: 'blob',
    });

    const viewRepoHref = getBrowsePath({
        repoName,
        revisionName: commit.hash,
        path: '',
        pathType: 'tree',
    });

    return (
        <div className="flex flex-row items-center gap-3 px-3 py-1.5 border-b min-w-0">
            <span
                className="text-sm font-mono text-muted-foreground flex-shrink-0"
                title={commit.hash}
            >
                {shortSha}
            </span>
            <span className="text-sm truncate flex-1 min-w-0" title={commit.message}>
                {commit.message}
            </span>
            <AuthorsAvatarGroup authors={authors} />
            <span
                className="text-sm text-muted-foreground flex-shrink-0 truncate max-w-[120px]"
                title={authors.map((a) => a.name).join(", ")}
            >
                {formatAuthorsText(authors)}
            </span>
            <span
                className="text-sm text-muted-foreground flex-shrink-0"
                title={commit.date}
            >
                {relativeDate}
            </span>
            <div className="flex flex-row items-center gap-1 flex-shrink-0">
                {isBlobPath && (
                    <CommitActionLink
                        href={viewCodeHref}
                        label="View code at this commit"
                        icon={<FileCode className="h-3 w-3" />}
                    />
                )}
                <CommitActionLink
                    href={viewRepoHref}
                    label="View repository at this commit"
                    icon={<Code className="h-3 w-3" />}
                />
            </div>
        </div>
    );
};
