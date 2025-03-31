"use client";
import { useDomain } from "@/hooks/useDomain";
import { ConnectionListItem } from "./connectionListItem";
import { cn, unwrapServiceError } from "@/lib/utils";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { getConnections } from "@/actions";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { env } from "@/env.mjs";
import { RepoIndexingStatus, ConnectionSyncStatus } from "@sourcebot/db";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import { MultiSelect } from "@/components/ui/multi-select";
import { OrgRole } from "@sourcebot/db";

interface ConnectionListProps {
    className?: string;
    role: OrgRole;
}

const convertSyncStatus = (status: ConnectionSyncStatus) => {
    switch (status) {
        case ConnectionSyncStatus.SYNC_NEEDED:
            return 'waiting';
        case ConnectionSyncStatus.SYNCING:
            return 'running';
        case ConnectionSyncStatus.SYNCED:
            return 'succeeded';
        case ConnectionSyncStatus.SYNCED_WITH_WARNINGS:
            return 'synced-with-warnings';
        case ConnectionSyncStatus.FAILED:
            return 'failed';
        default:
            return 'unknown';
    }
}

export const ConnectionList = ({
    className,
    role,
}: ConnectionListProps) => {
    const domain = useDomain();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

    const { data: unfilteredConnections, isPending, error } = useQuery({
        queryKey: ['connections', domain],
        queryFn: () => unwrapServiceError(getConnections(domain)),
        refetchInterval: env.NEXT_PUBLIC_POLLING_INTERVAL_MS,
    });

    const connections = useMemo(() => {
        return unfilteredConnections
            ?.filter((connection) => connection.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .filter((connection) => {
                if (selectedStatuses.length === 0) {
                    return true;
                }

                return selectedStatuses.includes(convertSyncStatus(connection.syncStatus));
            })
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()) ?? [];
    }, [unfilteredConnections, searchQuery, selectedStatuses]);

    if (error) {
        return <div className="flex flex-col items-center justify-center border rounded-md p-4 h-full">
            <p>Error loading connections: {error.message}</p>
        </div>
    }

    return (
        <div className={cn("flex flex-col gap-4", className)}>
            <div className="flex gap-4 flex-col sm:flex-row">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={`Filter ${isPending ? "n" : connections.length} ${connections.length === 1 ? "connection" : "connections"} by name`}
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <MultiSelect
                    className="bg-background hover:bg-background w-56"
                    options={[
                        { value: 'waiting', label: 'Waiting' },
                        { value: 'running', label: 'Syncing' },
                        { value: 'succeeded', label: 'Synced' },
                        { value: 'synced-with-warnings', label: 'Warnings' },
                        { value: 'failed', label: 'Failed' },
                    ]}
                    onValueChange={(value) => setSelectedStatuses(value)}
                    defaultValue={[]}
                    placeholder="Filter by status"
                    maxCount={2}
                    animation={0}
                />

            </div>

            {isPending ? (
                // Skeleton for loading state
                <div className="flex flex-col gap-4">
                    {Array.from({ length: 3 }).map((_, i) => (
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
            ) : connections.length > 0 ? (
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
                            disabled={role !== OrgRole.OWNER}
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