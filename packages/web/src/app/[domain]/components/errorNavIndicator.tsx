"use client";

import Link from "next/link";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { CircleXIcon } from "lucide-react";
import { useDomain } from "@/hooks/useDomain";
import { unwrapServiceError } from "@/lib/utils";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { env } from "@/env.mjs";
import { useQuery } from "@tanstack/react-query";
import { ConnectionSyncStatus, RepoIndexingStatus } from "@sourcebot/db";
import { getConnections } from "@/actions";
import { getRepos } from "@/actions";

export const ErrorNavIndicator = () => {
    const domain = useDomain();
    const captureEvent = useCaptureEvent();

    const { data: repos, isPending: isPendingRepos, isError: isErrorRepos } = useQuery({
        queryKey: ['repos', domain],
        queryFn: () => unwrapServiceError(getRepos(domain)),
        select: (data) => data.filter(repo => repo.repoIndexingStatus === RepoIndexingStatus.FAILED),
        refetchInterval: env.NEXT_PUBLIC_POLLING_INTERVAL_MS,
    });

    const { data: connections, isPending: isPendingConnections, isError: isErrorConnections } = useQuery({
        queryKey: ['connections', domain],
        queryFn: () => unwrapServiceError(getConnections(domain)),
        select: (data) => data.filter(connection => connection.syncStatus === ConnectionSyncStatus.FAILED),
        refetchInterval: env.NEXT_PUBLIC_POLLING_INTERVAL_MS,
    });

    if (isPendingRepos || isErrorRepos || isPendingConnections || isErrorConnections) {
        return null;
    }

    if (repos.length === 0 && connections.length === 0) {
        return null;
    }

    return (
        <HoverCard openDelay={50}>
            <HoverCardTrigger asChild onMouseEnter={() => captureEvent('wa_error_nav_hover', {})}>
                <Link href={`/${domain}/connections`} onClick={() => captureEvent('wa_error_nav_pressed', {})}>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-full text-red-700 dark:text-red-400 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors cursor-pointer">
                        <CircleXIcon className="h-4 w-4" />
                        {repos.length + connections.length > 0 && (
                            <span>{repos.length + connections.length}</span>
                        )}
                    </div>
                </Link>
            </HoverCardTrigger>
            <HoverCardContent className="w-80 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex flex-col gap-6 p-5">
                    {connections.length > 0 && (
                        <div className="flex flex-col gap-4 pb-6">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-red-500"></div>
                                <h3 className="text-sm font-medium text-red-700 dark:text-red-400">Connection Sync Issues</h3>
                            </div>
                            <p className="text-sm text-red-600/90 dark:text-red-300/90 leading-relaxed">
                                The following connections have failed to sync:
                            </p>
                            <div className="flex flex-col gap-2">
                                {connections
                                    .slice(0, 10)
                                    .map(connection => (
                                        <Link key={connection.name} href={`/${domain}/connections/${connection.id}`} onClick={() => captureEvent('wa_error_nav_job_pressed', {})}>
                                            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 
                                                            rounded-md text-sm text-red-700 dark:text-red-300 
                                                            border border-red-200/50 dark:border-red-800/50
                                                            hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                                                <span className="font-medium">{connection.name}</span>
                                            </div>
                                        </Link>
                                    ))}
                                {connections.length > 10 && (
                                    <div className="text-sm text-red-600/90 dark:text-red-300/90 pl-3 pt-1">
                                        And {connections.length - 10} more...
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {repos.length > 0 && (
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-red-500"></div>
                                <h3 className="text-sm font-medium text-red-700 dark:text-red-400">Repository Indexing Issues</h3>
                            </div>
                            <p className="text-sm text-red-600/90 dark:text-red-300/90 leading-relaxed">
                                The following repositories failed to index:
                            </p>
                            <div className="flex flex-col gap-2">
                                {repos
                                    .slice(0, 10)
                                    .filter(item => item.linkedConnections.length > 0) // edge case: don't show repos that are orphaned and awaiting gc.
                                    .map(repo => (
                                        // Link to the first connection for the repo
                                        <Link key={repo.repoId} href={`/${domain}/connections/${repo.linkedConnections[0].id}`} onClick={() => captureEvent('wa_error_nav_job_pressed', {})}>
                                            <div className="flex items-center justify-between px-3 py-2 
                                                            bg-red-50 dark:bg-red-900/20 rounded-md
                                                            border border-red-200/50 dark:border-red-800/50
                                                            hover:bg-red-100 dark:hover:bg-red-900/30 
                                                            transition-colors">
                                                <span className="text-sm font-medium text-red-700 dark:text-red-300">
                                                    {repo.repoName}
                                                </span>
                                            </div>
                                        </Link>
                                    ))}
                                {repos.length > 10 && (
                                    <div className="text-sm text-red-600/90 dark:text-red-300/90 pl-3 pt-1">
                                        And {repos.length - 10} more...
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </HoverCardContent>
        </HoverCard>
    );
};
