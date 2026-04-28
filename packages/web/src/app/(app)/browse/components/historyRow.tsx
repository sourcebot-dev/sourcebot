'use client';

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Code, FileCode } from "lucide-react";
import type { Commit } from "@/features/git";
import { cn } from "@/lib/utils";
import { HoverPrefetchLink } from "@/app/(app)/components/hoverPrefetchLink";
import { useBrowseParams } from "../hooks/useBrowseParams";
import { BrowsePathType, getBrowsePath, PREVIEW_REF_QUERY_PARAM } from "../hooks/utils";
import { formatAuthorsText, getCommitAuthors } from "./commitAuthors";
import { AuthorsAvatarGroup, CommitActionLink } from "./commitParts";

interface HistoryRowProps {
    commit: Commit;
    repoName: string;
    revisionName?: string;
    path: string;
    pathType: BrowsePathType;
}

export const HistoryRow = ({ commit, repoName, revisionName, path, pathType }: HistoryRowProps) => {
    const browseParams = useBrowseParams();
    const searchParams = useSearchParams();
    const shortSha = commit.hash.slice(0, 7);
    const relativeDate = formatDistanceToNow(new Date(commit.date), { addSuffix: true });
    const isBlobPath = pathType === 'blob';

    const isSelected =
        browseParams.pathType === 'blob' &&
        searchParams.get(PREVIEW_REF_QUERY_PARAM) === commit.hash;

    const authors = useMemo(() => getCommitAuthors(commit), [commit]);

    const viewCodeHref = getBrowsePath({
        repoName,
        revisionName,
        path,
        pathType: 'blob',
        previewRef: commit.hash,
    });

    const viewRepoHref = getBrowsePath({
        repoName,
        revisionName: commit.hash,
        path: '',
        pathType: 'tree',
    });

    // The short SHA always links to the full commit diff (`/-/commit/<sha>`).
    const fullCommitHref = getBrowsePath({
        repoName,
        revisionName,
        path: '',
        pathType: 'commit',
        commitSha: commit.hash,
    });

    // The commit message links to the focused diff for the current file —
    // only meaningful when the user is browsing a file (blob path).
    const focusedDiffHref = isBlobPath
        ? getBrowsePath({
            repoName,
            revisionName,
            path,
            pathType: 'blob',
            previewRef: commit.hash,
            diff: true,
        })
        : undefined;

    return (
        <div
            className={cn(
                'flex flex-row items-center gap-3 px-3 py-1.5 border-b min-w-0',
                isSelected ? 'bg-accent' : 'hover:bg-muted',
            )}
        >
            <HoverPrefetchLink
                href={fullCommitHref}
                className="text-sm font-mono text-muted-foreground hover:underline flex-shrink-0"
                title={commit.hash}
            >
                {shortSha}
            </HoverPrefetchLink>
            {focusedDiffHref ? (
                <HoverPrefetchLink
                    href={focusedDiffHref}
                    className="text-sm truncate flex-1 min-w-0 hover:underline"
                    title={commit.message}
                >
                    {commit.message}
                </HoverPrefetchLink>
            ) : (
                <span
                    className="text-sm truncate flex-1 min-w-0"
                    title={commit.message}
                >
                    {commit.message}
                </span>
            )}
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
