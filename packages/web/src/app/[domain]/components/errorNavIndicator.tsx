"use client";

import Link from "next/link";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { CircleXIcon } from "lucide-react";
import { useDomain } from "@/hooks/useDomain";
import { isServiceError } from "@/lib/utils";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { NEXT_PUBLIC_POLLING_INTERVAL_MS } from "@/lib/environment.client";
import { useQuery } from "@tanstack/react-query";
import { ConnectionSyncStatus, RepoIndexingStatus } from "@sourcebot/db";
import { getConnections } from "@/actions";
import { getRepos } from "@/actions";

export const ErrorNavIndicator = () => {
    const domain = useDomain();
    const captureEvent = useCaptureEvent();

    const { data: failedRepos } = useQuery({
        queryKey: ['repos', domain],
        queryFn: () => getRepos(domain),
        select: (data) => {
            if (isServiceError(data)) {
                return data;
            }
            return data.filter(repo => repo.repoIndexingStatus === RepoIndexingStatus.FAILED);
        },
        refetchInterval: NEXT_PUBLIC_POLLING_INTERVAL_MS,
        initialData: [],
    });

    const { data: failedConnections } = useQuery({
        queryKey: ['connections', domain],
        queryFn: () => getConnections(domain),
        select: (data) => {
            if (isServiceError(data)) {
                return data;
            }
            return data.filter(connection => connection.syncStatus === ConnectionSyncStatus.FAILED)
        },
        refetchInterval: NEXT_PUBLIC_POLLING_INTERVAL_MS,
        initialData: [],
    });

    if (isServiceError(failedRepos) || isServiceError(failedConnections) || (failedRepos.length === 0 && failedConnections.length === 0)) return null;

    return (
        <HoverCard openDelay={50}>
            <HoverCardTrigger asChild onMouseEnter={() => captureEvent('wa_error_nav_hover', {})}>
                <Link href={`/${domain}/connections`} onClick={() => captureEvent('wa_error_nav_pressed', {})}>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-full text-red-700 dark:text-red-400 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors cursor-pointer">
                        <CircleXIcon className="h-4 w-4" />
                        {failedRepos.length + failedConnections.length > 0 && (
                            <span>{failedRepos.length + failedConnections.length}</span>
                        )}
                    </div>
                </Link>
            </HoverCardTrigger>
            <HoverCardContent className="w-80 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex flex-col gap-6 p-5">
                    {failedConnections.length > 0 && (
                        <div className="flex flex-col gap-4 pb-6">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-red-500"></div>
                                <h3 className="text-sm font-medium text-red-700 dark:text-red-400">Connection Sync Issues</h3>
                            </div>
                            <p className="text-sm text-red-600/90 dark:text-red-300/90 leading-relaxed">
                                The following connections have failed to sync:
                            </p>
                            <div className="flex flex-col gap-2">
                                {failedConnections
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
                                {failedConnections.length > 10 && (
                                    <div className="text-sm text-red-600/90 dark:text-red-300/90 pl-3 pt-1">
                                        And {failedConnections.length - 10} more...
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {failedRepos.length > 0 && (
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-red-500"></div>
                                <h3 className="text-sm font-medium text-red-700 dark:text-red-400">Repository Indexing Issues</h3>
                            </div>
                            <p className="text-sm text-red-600/90 dark:text-red-300/90 leading-relaxed">
                                The following repositories failed to index:
                            </p>
                            <div className="flex flex-col gap-2">
                                {failedRepos
                                    .slice(0, 10)
                                    .map(repo => (
                                        // Link to the first connection for the repo
                                        <Link key={repo.repoId} href={`/${domain}/connections/${repo.linkedConnections[0]}`} onClick={() => captureEvent('wa_error_nav_job_pressed', {})}>
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
                                {failedRepos.length > 10 && (
                                    <div className="text-sm text-red-600/90 dark:text-red-300/90 pl-3 pt-1">
                                        And {failedRepos.length - 10} more...
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
