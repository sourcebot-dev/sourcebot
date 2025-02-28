"use client";

import { DataTable } from "@/components/ui/data-table";
import { columns, RepositoryColumnInfo } from "./columns";
import { unwrapServiceError } from "@/lib/utils";
import { getRepos } from "@/actions";
import { useQuery } from "@tanstack/react-query";
import { NEXT_PUBLIC_POLLING_INTERVAL_MS } from "@/lib/environment.client";
import { useDomain } from "@/hooks/useDomain";
import { RepoIndexingStatus } from "@sourcebot/db";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export const RepositoryTable = () => {
    const domain = useDomain();
    const { data: repos, isLoading: reposLoading, error: reposError } = useQuery({
        queryKey: ['repos', domain],
        queryFn: async () => {
            return await unwrapServiceError(getRepos(domain));
        },
        refetchInterval: NEXT_PUBLIC_POLLING_INTERVAL_MS,
        refetchIntervalInBackground: true,
    });

    const tableRepos = useMemo(() => {
        if (reposLoading) return Array(4).fill(null).map(() => ({
            name: "",
            connections: [],
            repoIndexingStatus: RepoIndexingStatus.NEW,
            lastIndexed: "",
            url: "",
            imageUrl: "",
        }));

        if (!repos) return [];
        return repos.map((repo): RepositoryColumnInfo => ({
            name: repo.repoName.split('/').length > 2 ? repo.repoName.split('/').slice(-2).join('/') : repo.repoName,
            imageUrl: repo.imageUrl,
            connections: repo.linkedConnections,
            repoIndexingStatus: repo.repoIndexingStatus as RepoIndexingStatus,
            lastIndexed: repo.indexedAt?.toISOString() ?? "",
            url: repo.repoCloneUrl,
        })).sort((a, b) => {
            return new Date(b.lastIndexed).getTime() - new Date(a.lastIndexed).getTime();
        });
    }, [repos, reposLoading]);

    const tableColumns = useMemo(() => {
        if (reposLoading) {
            return columns(domain).map((column) => {
                if ('accessorKey' in column && column.accessorKey === "name") {
                  return {
                    ...column,
                    cell: () => (
                      <div className="flex flex-row items-center gap-3 py-2">
                        <Skeleton className="h-8 w-8 rounded-md" /> {/* Avatar skeleton */}
                        <Skeleton className="h-4 w-48" /> {/* Repository name skeleton */}
                      </div>
                    ),
                  }
                }
        
                return {
                  ...column,
                  cell: () => (
                    <div className="flex flex-wrap gap-1.5">
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </div>
                  ),
                }
              })
        }

        return columns(domain);
    }, [reposLoading, domain]);


    if (reposError) {
        return <div>Error loading repositories</div>;
    }

    return (
        <DataTable
            columns={tableColumns}
            data={tableRepos}
            searchKey="name"
            searchPlaceholder="Search repositories..."
        />
    );
}