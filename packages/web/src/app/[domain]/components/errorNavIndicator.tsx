"use client";

import Link from "next/link";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { CircleXIcon } from "lucide-react";
import { useDomain } from "@/hooks/useDomain";
import { getConnectionFailedRepos, getConnections } from "@/actions";
import { useState, useEffect } from "react";
import { isServiceError } from "@/lib/utils";

enum ConnectionErrorType {
    SYNC_FAILED = "SYNC_FAILED",
    REPO_INDEXING_FAILED = "REPO_INDEXING_FAILED",
}

interface Error {
    connectionId?: number;
    connectionName?: string;
    errorType: ConnectionErrorType;
}

export const ErrorNavIndicator = () => {
    const domain = useDomain();
    const [errors, setErrors] = useState<Error[]>([]);

    useEffect(() => {
        const fetchErrors = async () => {
            const connections = await getConnections(domain);
            const errors: Error[] = [];
            if (!isServiceError(connections)) {
                for (const connection of connections) {
                    if (connection.syncStatus === 'FAILED') {
                        errors.push({
                            connectionId: connection.id,
                            connectionName: connection.name,
                            errorType: ConnectionErrorType.SYNC_FAILED
                        });
                    }

                    const failedRepos = await getConnectionFailedRepos(connection.id, domain);
                    if (!isServiceError(failedRepos) && failedRepos.length > 0) {
                        errors.push({
                            connectionId: connection.id,
                            connectionName: connection.name,
                            errorType: ConnectionErrorType.REPO_INDEXING_FAILED
                        });
                    }
                }
            }
            setErrors(errors);
        };

        fetchErrors();
        const intervalId = setInterval(fetchErrors, 1000);
        return () => clearInterval(intervalId);
    }, [domain]);

    if (errors.length === 0) return null;

    return (
        <Link href={`/${domain}/connections`}>
            <HoverCard>
                <HoverCardTrigger asChild>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-full text-red-700 dark:text-red-400 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors cursor-pointer">
                        <CircleXIcon className="h-4 w-4" />
                        <span>{errors.length}</span>
                    </div>
                </HoverCardTrigger>
                <HoverCardContent className="w-80 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex flex-col gap-6 p-5">
                        {errors.filter(e => e.errorType === 'SYNC_FAILED').length > 0 && (
                            <div className="flex flex-col gap-4 border-b border-red-200 dark:border-red-800 pb-6">
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-red-500"></div>
                                    <h3 className="text-sm font-medium text-red-700 dark:text-red-400">Connection Sync Issues</h3>
                                </div>
                                <p className="text-sm text-red-600/90 dark:text-red-300/90 leading-relaxed">
                                    The following connections have failed to sync:
                                </p>
                                <div className="flex flex-col gap-2 pl-4">
                                    {errors.filter(e => e.errorType === 'SYNC_FAILED').map(error => (
                                        <Link key={error.connectionName} href={`/${domain}/connections/${error.connectionId}`}>
                                            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 
                                                        rounded-md text-sm text-red-700 dark:text-red-300 
                                                        border border-red-200/50 dark:border-red-800/50
                                                        hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                                                <span className="font-medium">{error.connectionName}</span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {errors.filter(e => e.errorType === 'REPO_INDEXING_FAILED').length > 0 && (
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-red-500"></div>
                                    <h3 className="text-sm font-medium text-red-700 dark:text-red-400">Repository Indexing Issues</h3>
                                </div>
                                <p className="text-sm text-red-600/90 dark:text-red-300/90 leading-relaxed">
                                    The following connections have repositories that failed to index:
                                </p>
                                <div className="flex flex-col gap-2 pl-4">
                                    {errors.filter(e => e.errorType === 'REPO_INDEXING_FAILED').map(error => (
                                        <Link key={error.connectionName} href={`/${domain}/connections/${error.connectionId}`}>
                                            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 
                                                        rounded-md text-sm text-red-700 dark:text-red-300
                                                        border border-red-200/50 dark:border-red-800/50
                                                        hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                                                <span className="font-medium">{error.connectionName}</span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </HoverCardContent>
            </HoverCard>
        </Link>
    );
};
