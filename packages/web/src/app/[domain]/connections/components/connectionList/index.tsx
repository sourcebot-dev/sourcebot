"use client";
import { useDomain } from "@/hooks/useDomain";
import { ConnectionListItem } from "./connectionListItem";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { ConnectionSyncStatus, Prisma } from "@sourcebot/db";
import { getConnectionFailedRepos, getConnections } from "@/actions";
import { isServiceError } from "@/lib/utils";

interface ConnectionListProps {
    className?: string;
}

export const ConnectionList = ({
    className,
}: ConnectionListProps) => {
    const domain = useDomain();
    const [connections, setConnections] = useState<{
        id: number;
        name: string;
        connectionType: string;
        syncStatus: ConnectionSyncStatus;
        syncStatusMetadata: Prisma.JsonValue;
        updatedAt: Date;
        syncedAt?: Date;
        failedRepos?: { repoId: number, repoName: string }[];
    }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {   
        const fetchConnections = async () => {
            try {
                const result = await getConnections(domain);
                if (isServiceError(result)) {
                    setError(result.message);
                } else {
                    const connectionsWithFailedRepos = [];
                    for (const connection of result) {
                        const failedRepos = await getConnectionFailedRepos(connection.id, domain);
                        if (isServiceError(failedRepos)) {
                            setError(`An error occured while fetching the failed repositories for connection ${connection.name}. If the problem persists, please contact us at team@sourcebot.dev`);
                        } else {
                            connectionsWithFailedRepos.push({
                                ...connection,
                                failedRepos,
                            });
                        }
                    }
                    setConnections(connectionsWithFailedRepos);
                }
                setLoading(false);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occured while fetching connections. If the problem persists, please contact us at team@sourcebot.dev');
                setLoading(false);
            }
        };

        fetchConnections();
    }, [domain]);

    return (
        <div className={cn("flex flex-col gap-4", className)}>
            {loading ? (
                <div className="flex flex-col items-center justify-center border rounded-md p-4 h-full">
                    <p>Loading connections...</p>
                </div>
            ) : error ? (
                <div className="flex flex-col items-center justify-center border rounded-md p-4 h-full">
                    <p>Error loading connections: {error}</p>
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
                            failedRepos={connection.failedRepos}
                        />
                    ))
            ) : (
                <div className="flex flex-col items-center justify-center border rounded-md p-4 h-full">
                    <InfoCircledIcon className="w-7 h-7" />
                    <h2 className="mt-2 font-medium">No connections</h2>
                </div>
            )}
        </div>
    )
}