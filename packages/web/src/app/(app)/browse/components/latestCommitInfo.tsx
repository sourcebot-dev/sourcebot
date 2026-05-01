'use client';

import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { listCommits } from "@/app/api/(client)/client";
import { isServiceError } from "@/lib/utils";
import { useBrowseParams } from "../hooks/useBrowseParams";
import { formatAuthorsText, getCommitAuthors } from "./commitAuthors";
import { AuthorsAvatarGroup } from "./commitParts";

export const LatestCommitInfo = () => {
    const { repoName, revisionName, path } = useBrowseParams();

    const { data: commit } = useQuery({
        queryKey: ['latestCommitInfo', repoName, revisionName ?? null, path],
        queryFn: async () => {
            const result = await listCommits({
                repo: repoName,
                ref: revisionName,
                path: path || undefined,
                page: 1,
                perPage: 1,
            });
            if (isServiceError(result)) {
                throw new Error(result.message);
            }
            return result.commits[0] ?? null;
        },
    });

    const authors = useMemo(
        () => (commit ? getCommitAuthors(commit) : []),
        [commit],
    );

    if (!commit) {
        return null;
    }

    const relativeDate = formatDistanceToNow(new Date(commit.date), { addSuffix: true });

    return (
        <div className="flex flex-row items-center gap-2 min-w-0 overflow-hidden">
            <AuthorsAvatarGroup authors={authors} />
            <span className="text-sm font-medium flex-shrink-0" title={authors.map((a) => a.name).join(", ")}>
                {formatAuthorsText(authors)}
            </span>
            <span className="text-sm text-muted-foreground truncate" title={commit.message}>
                {commit.message}
            </span>
            <span className="text-sm text-muted-foreground flex-shrink-0" title={commit.date}>
                {relativeDate}
            </span>
        </div>
    );
};
