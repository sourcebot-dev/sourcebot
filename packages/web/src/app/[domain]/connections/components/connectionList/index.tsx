"use client";
import { useDomain } from "@/hooks/useDomain";
import { ConnectionListItem } from "./connectionListItem";
import { cn, isServiceError } from "@/lib/utils";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { getConnections } from "@/actions";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { NEXT_PUBLIC_POLLING_INTERVAL_MS } from "@/lib/environment.client";
import { RepoIndexingStatus } from "@sourcebot/db";

interface ConnectionListProps {
    className?: string;
}

export const ConnectionList = ({
    className,
}: ConnectionListProps) => {
    const domain = useDomain();

    const { data: connections, isLoading, error } = useQuery({
        queryKey: ['connections', domain],
        queryFn: () => getConnections(domain),
        refetchInterval: NEXT_PUBLIC_POLLING_INTERVAL_MS,
    });

    if (isServiceError(connections)) {
        return <div className="flex flex-col items-center justify-center border rounded-md p-4 h-full">
            <p>Error loading connections: {connections.message}</p>
        </div>
    }

    return (
        <div className={cn("flex flex-col gap-4", className)}>
            {isLoading ? (
                <div className="flex flex-col gap-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-4 border rounded-md p-4">
                            <Skeleton className="w-8 h-8 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-1/4" />
                                <Skeleton className="h-3 w-1/3" />
                            </div>
                            <Skeleton className="w-24 h-8" />
                        </div>
                    ))}
                </div>
            ) : error ? (
                <div className="flex flex-col items-center justify-center border rounded-md p-4 h-full">
                    <p>Error loading connections: {error instanceof Error ? error.message : 'An unknown error occurred'}</p>
                </div>
            ) : connections && connections.length > 0 ? (
                connections
                    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
                    .map((connection) => (
                        <ConnectionListItem
                            key={connection.id}
                            id={connection.id.toString()}
                            name={connection.name}
                            type={connection.connectionType}
                            status={connection.syncStatus}
                            syncStatusMetadata={connection.syncStatusMetadata}
                            editedAt={connection.updatedAt}
                            syncedAt={connection.syncedAt ?? undefined}
                            failedRepos={connection.linkedRepos.filter((repo) => repo.repoIndexingStatus === RepoIndexingStatus.FAILED).map((repo) => ({
                                repoId: repo.id,
                                repoName: repo.name,
                            }))}
                        />
                    ))
            ) : (
                <div className="flex flex-col items-center justify-center border rounded-md p-4 h-full">
                    <InfoCircledIcon className="w-7 h-7" />
                    <h2 className="mt-2 font-medium">No connections</h2>
                </div>
            )}
        </div>
    );
}