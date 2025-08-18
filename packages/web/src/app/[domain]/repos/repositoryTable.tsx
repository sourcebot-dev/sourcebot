"use client";

import { DataTable } from "@/components/ui/data-table";
import { columns, RepositoryColumnInfo } from "./columns";
import { unwrapServiceError } from "@/lib/utils";
import { getRepos } from "@/actions";
import { useQuery } from "@tanstack/react-query";
import { useDomain } from "@/hooks/useDomain";
import { RepoIndexingStatus } from "@sourcebot/db";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { env } from "@/env.mjs";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { AddRepositoryDialog } from "./components/addRepositoryDialog";
import { useState } from "react";

interface RepositoryTableProps {
    isAddReposButtonVisible: boolean
}

export const RepositoryTable = ({
    isAddReposButtonVisible,
}: RepositoryTableProps) => {
    const domain = useDomain();
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

    const { data: repos, isLoading: reposLoading, error: reposError } = useQuery({
        queryKey: ['repos', domain],
        queryFn: async () => {
            return await unwrapServiceError(getRepos(domain));
        },
        refetchInterval: env.NEXT_PUBLIC_POLLING_INTERVAL_MS,
        refetchIntervalInBackground: true,
    });

    const tableRepos = useMemo(() => {
        if (reposLoading) return Array(4).fill(null).map(() => ({
            repoId: 0,
            name: "",
            connections: [],
            repoIndexingStatus: RepoIndexingStatus.NEW,
            lastIndexed: "",
            url: "",
            imageUrl: "",
        }));

        if (!repos) return [];
        return repos.map((repo): RepositoryColumnInfo => ({
            repoId: repo.repoId,
            name: repo.repoDisplayName ?? repo.repoName,
            imageUrl: repo.imageUrl,
            connections: repo.linkedConnections,
            repoIndexingStatus: repo.repoIndexingStatus as RepoIndexingStatus,
            lastIndexed: repo.indexedAt?.toISOString() ?? "",
            url: repo.webUrl ?? repo.repoCloneUrl,
        })).sort((a, b) => {
            const getPriorityFromStatus = (status: RepoIndexingStatus) => {
                switch (status) {
                    case RepoIndexingStatus.IN_INDEX_QUEUE:
                    case RepoIndexingStatus.INDEXING:
                        return 0  // Highest priority - currently indexing
                    case RepoIndexingStatus.FAILED:
                        return 1  // Second priority - failed repos need attention
                    case RepoIndexingStatus.INDEXED:
                        return 2  // Third priority - successfully indexed
                    default:
                        return 3  // Lowest priority - other statuses (NEW, etc.)
                }
            }

            // Sort by priority first
            const aPriority = getPriorityFromStatus(a.repoIndexingStatus);
            const bPriority = getPriorityFromStatus(b.repoIndexingStatus);
            
            if (aPriority !== bPriority) {
                return aPriority - bPriority; // Lower priority number = higher precedence
            }
            
            // If same priority, sort by last indexed date (most recent first)
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
        <>
            <DataTable
                columns={tableColumns}
                data={tableRepos}
                searchKey="name"
                searchPlaceholder="Search repositories..."
                headerActions={isAddReposButtonVisible && (
                    <Button
                        variant="default"
                        size="default"
                        onClick={() => setIsAddDialogOpen(true)}
                    >
                        <PlusIcon className="w-4 h-4" />
                        Add repository
                    </Button>
                )}
            />
            
            <AddRepositoryDialog
                isOpen={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
            />
        </>
    );
}