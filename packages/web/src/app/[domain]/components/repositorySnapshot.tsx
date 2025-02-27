"use client";

import Link from "next/link";
import { RepositoryCarousel } from "./repositoryCarousel";
import { useDomain } from "@/hooks/useDomain";
import { useQuery } from "@tanstack/react-query";
import { unwrapServiceError } from "@/lib/utils";
import { getRepos } from "@/actions";
import { NEXT_PUBLIC_POLLING_INTERVAL_MS } from "@/lib/environment.client";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
} from "@/components/ui/carousel";
import { Plus } from "lucide-react";
import { RepoIndexingStatus } from "@sourcebot/db";
import { SymbolIcon } from "@radix-ui/react-icons";

export function EmptyRepoState({ domain }: { domain: string }) {
    return (
      <div className="flex flex-col items-center gap-3">
        <span className="text-sm">No repositories found</span>
  
        <div className="w-full max-w-lg">
          <div className="flex flex-row items-center gap-2 border rounded-md p-4 justify-center">
            <span className="text-sm text-muted-foreground">
              Create a{" "}
              <Link href={`/${domain}/connections`} className="text-blue-500 hover:underline inline-flex items-center gap-1">
                connection
              </Link>{" "}
              to start indexing repositories
            </span>
          </div>
        </div>
      </div>
    )
  }

export default function RepoSkeleton() {
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


export function RepositorySnapshot() {
    const domain = useDomain();

    const { data: repos, isPending, isError } = useQuery({
        queryKey: ['repos', domain],
        queryFn: () => unwrapServiceError(getRepos(domain)),
        refetchInterval: NEXT_PUBLIC_POLLING_INTERVAL_MS,
    });

    if (isPending || isError || !repos) {
        return (
            <div className="flex flex-col items-center gap-3">
                <RepoSkeleton />
            </div>
        )
    }

    if (repos.length === 0) {
        return (
            <EmptyRepoState domain={domain} />
        )
    }

    const numIndexedRepos = repos.filter((repo) => repo.repoIndexingStatus === RepoIndexingStatus.INDEXED).length;
    const numIndexingRepos = repos.filter((repo) => repo.repoIndexingStatus === RepoIndexingStatus.INDEXING || repo.repoIndexingStatus === RepoIndexingStatus.IN_INDEX_QUEUE).length;
    if (numIndexedRepos === 0 && numIndexingRepos > 0) {
        return (
            <div className="flex flex-row items-center gap-3">
                <SymbolIcon className="h-4 w-4 animate-spin" />
                <span className="text-sm">indexing in progress...</span>
            </div>
        )
    }

    const indexedRepos = repos.filter((repo) => repo.repoIndexingStatus === RepoIndexingStatus.INDEXED);
    return (
        <div className="flex flex-col items-center gap-3">
            <span className="text-sm">
                {`Search ${indexedRepos.length} `}
                <Link
                    href={`${domain}/repos`}
                    className="text-blue-500"
                >
                    {repos.length > 1 ? 'repositories' : 'repository'}
                </Link>
            </span>
            <RepositoryCarousel repos={indexedRepos} />
        </div>
    )
}