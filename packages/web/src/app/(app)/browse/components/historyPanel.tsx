'use client';

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { listCommits } from "@/app/api/(client)/client";
import { isServiceError } from "@/lib/utils";
import type { ListCommitsResponse } from "@/features/git";
import { useBrowseParams } from "../hooks/useBrowseParams";
import { HistoryRow } from "./historyRow";

const PER_PAGE = 25;

type CommitsPage = ListCommitsResponse & { page: number };

export const HistoryPanel = () => {
    const { repoName, revisionName, path } = useBrowseParams();

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        status,
        error,
    } = useInfiniteQuery<CommitsPage>({
        queryKey: ['historyPanelCommits', repoName, revisionName ?? null, path],
        queryFn: async ({ pageParam }) => {
            const page = pageParam as number;
            const result = await listCommits({
                repo: repoName,
                ref: revisionName,
                path: path || undefined,
                page,
                perPage: PER_PAGE,
            });
            if (isServiceError(result)) {
                throw new Error(result.message);
            }
            return { ...result, page };
        },
        initialPageParam: 1,
        getNextPageParam: (lastPage) => {
            const seenSoFar = lastPage.page * PER_PAGE;
            return seenSoFar < lastPage.totalCount ? lastPage.page + 1 : undefined;
        },
    });

    const sentinelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel || !hasNextPage) {
            return;
        }
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !isFetchingNextPage) {
                    fetchNextPage();
                }
            },
            { rootMargin: '100px' },
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    const allCommits = data?.pages.flatMap((p) => p.commits) ?? [];

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-auto">
                {status === 'pending' && (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                )}
                {status === 'error' && (
                    <div className="flex flex-col items-center justify-center py-8 gap-1 text-sm text-muted-foreground">
                        <span>Failed to load commit history</span>
                        {error instanceof Error && (
                            <span className="text-xs">{error.message}</span>
                        )}
                    </div>
                )}
                {status === 'success' && allCommits.length === 0 && (
                    <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                        No commits found
                    </div>
                )}
                {status === 'success' && allCommits.map((commit) => (
                    <HistoryRow
                        key={commit.hash}
                        commit={commit}
                        repoName={repoName}
                        path={path}
                    />
                ))}
                {hasNextPage && (
                    <div
                        ref={sentinelRef}
                        className="flex items-center justify-center py-3"
                    >
                        {isFetchingNextPage && (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                    </div>
                )}
                {status === 'success' && !hasNextPage && allCommits.length > 0 && (
                    <div className="py-4 text-center text-sm text-muted-foreground">
                        End of commit history
                    </div>
                )}
            </div>
        </div>
    );
};
