"use client";

import Link from "next/link";
import { RepositoryCarousel } from "./repositoryCarousel";
import { useDomain } from "@/hooks/useDomain";
import { useQuery } from "@tanstack/react-query";
import { unwrapServiceError } from "@/lib/utils";
import { getRepos } from "@/actions";
import { env } from "@/env.mjs";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
} from "@/components/ui/carousel";
import { RepoIndexingStatus } from "@sourcebot/db";
import { SymbolIcon } from "@radix-ui/react-icons";
import { RepositoryQuery } from "@/lib/types";

interface RepositorySnapshotProps {
    authEnabled: boolean;
    repos: RepositoryQuery[];
}

export function RepositorySnapshot({
    authEnabled,
    repos: initialRepos,
}: RepositorySnapshotProps) {
    const domain = useDomain();

    const { data: repos, isPending, isError } = useQuery({
        queryKey: ['repos', initialRepos, domain],
        queryFn: () => unwrapServiceError(getRepos(domain)),
        refetchInterval: env.NEXT_PUBLIC_POLLING_INTERVAL_MS,
        initialData: initialRepos,
    });

    if (isPending || isError || !repos) {
        return (
            <div className="flex flex-col items-center gap-3">
                <RepoSkeleton />
            </div>
        )
    }

    // Use `indexedAt` to determine if a repo has __ever__ been indexed.
    // The repo indexing status only tells us the repo's current indexing status.
    const indexedRepos = repos.filter((repo) => repo.indexedAt !== undefined);

    // If there are no indexed repos...
    if (indexedRepos.length === 0) {

        // ... show a loading state if repos are being indexed now
        if (repos.some((repo) => repo.repoIndexingStatus === RepoIndexingStatus.INDEXING || repo.repoIndexingStatus === RepoIndexingStatus.IN_INDEX_QUEUE)) {
            return (
                <div className="flex flex-row items-center gap-3">
                    <SymbolIcon className="h-4 w-4 animate-spin" />
                    <span className="text-sm">indexing in progress...</span>
                </div>
            )

        // ... otherwise, show the empty state.
        } else {
            return (
                <EmptyRepoState domain={domain} authEnabled={authEnabled} />
            )
        }
    }
 
    return (
        <div className="flex flex-col items-center gap-3">
            <span className="text-sm">
                {`Search ${indexedRepos.length} `}
                <Link
                    href={`${domain}/repos`}
                    className="text-blue-500"
                >
                    {indexedRepos.length > 1 ? 'repositories' : 'repository'}
                </Link>
            </span>
            <RepositoryCarousel repos={indexedRepos} />
        </div>
    )
}

function EmptyRepoState({ domain, authEnabled }: { domain: string, authEnabled: boolean }) {
    return (
        <div className="flex flex-col items-center gap-3">
            <span className="text-sm">No repositories found</span>

            <div className="w-full max-w-lg">
                <div className="flex flex-row items-center gap-2 border rounded-md p-4 justify-center">
                    <span className="text-sm text-muted-foreground">
                        {authEnabled ? (
                            <>
                                Create a{" "}
                                <Link href={`/${domain}/connections`} className="text-blue-500 hover:underline inline-flex items-center gap-1">
                                    connection
                                </Link>{" "}
                                to start indexing repositories
                            </>
                        ) : (
                            <>
                                Create a {" "}
                                <Link href={`https://docs.sourcebot.dev/self-hosting`} className="text-blue-500 hover:underline inline-flex items-center gap-1" target="_blank">
                                    configuration file
                                </Link>{" "}
                                to start indexing repositories
                            </>
                        )}
                    </span>
                </div>
            </div>
        </div>
    )
}

function RepoSkeleton() {
    return (
        <div className="flex flex-col items-center gap-3">
            {/* Skeleton for "Search X repositories" text */}
            <div className="flex items-center gap-1 text-sm">
                <Skeleton className="h-4 w-14" /> {/* "Search X" */}
                <Skeleton className="h-4 w-24" /> {/* "repositories" */}
            </div>

            {/* Skeleton for repository carousel */}
            <Carousel
                opts={{
                    align: "start",
                    loop: true,
                }}
                className="w-full max-w-lg"
            >
                <CarouselContent>
                    {[1, 2, 3].map((_, index) => (
                        <CarouselItem key={index} className="basis-auto">
                            <div className="flex flex-row items-center gap-2 border rounded-md p-2">
                                <Skeleton className="h-4 w-4 rounded-sm" /> {/* Icon */}
                                <Skeleton className="h-4 w-32" /> {/* Repository name */}
                            </div>
                        </CarouselItem>
                    ))}
                </CarouselContent>
            </Carousel>
        </div>
    )
}
