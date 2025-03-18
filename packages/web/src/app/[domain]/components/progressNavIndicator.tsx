"use client";

import { getRepos } from "@/actions";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { useDomain } from "@/hooks/useDomain";
import { env } from "@/env.mjs";
import { unwrapServiceError } from "@/lib/utils";
import { RepoIndexingStatus } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import Link from "next/link";

export const ProgressNavIndicator = () => {
    const domain = useDomain();
    const captureEvent = useCaptureEvent();

    const { data: inProgressRepos, isPending, isError } = useQuery({
        queryKey: ['repos', domain],
        queryFn: () => unwrapServiceError(getRepos(domain)),
        select: (data) => data.filter(repo => repo.repoIndexingStatus === RepoIndexingStatus.IN_INDEX_QUEUE || repo.repoIndexingStatus === RepoIndexingStatus.INDEXING),
        refetchInterval: env.NEXT_PUBLIC_POLLING_INTERVAL_MS,
    });

    if (isPending || isError || inProgressRepos.length === 0) {
        return null;
    }

    return (
        <Link
            href={`/${domain}/connections`}
            onClick={() => captureEvent('wa_progress_nav_pressed', {})}
        >
            <HoverCard openDelay={50}>
                <HoverCardTrigger asChild onMouseEnter={() => captureEvent('wa_progress_nav_hover', {})}>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-full text-green-700 dark:text-green-400 text-xs font-medium hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors cursor-pointer">
                        <Loader2Icon className="h-4 w-4 animate-spin" />
                        <span>{inProgressRepos.length}</span>
                    </div>
                </HoverCardTrigger>
                <HoverCardContent className="w-80 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex flex-col gap-4 p-5">
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                            <h3 className="text-sm font-medium text-green-700 dark:text-green-400">Indexing in Progress</h3>
                        </div>
                        <p className="text-sm text-green-600/90 dark:text-green-300/90 leading-relaxed">
                            The following repositories are currently being indexed:
                        </p>
                        <div className="flex flex-col gap-2 pl-4">
                            {inProgressRepos.slice(0, 10).map(item => (
                                // Link to the first connection for the repo
                                <Link key={item.repoId} href={`/${domain}/connections/${item.linkedConnections[0].id}`} onClick={() => captureEvent('wa_progress_nav_job_pressed', {})}>
                                    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 
                                                rounded-md text-sm text-green-700 dark:text-green-300 
                                                border border-green-200/50 dark:border-green-800/50
                                                hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
                                        <span className="font-medium truncate">{item.repoName}</span>
                                    </div>
                                </Link>
                            ))}
                            {inProgressRepos.length > 10 && (
                                <div className="text-sm text-green-600/90 dark:text-green-300/90 pl-3 pt-1">
                                    And {inProgressRepos.length - 10} more...
                                </div>
                            )}
                        </div>
                    </div>
                </HoverCardContent>
            </HoverCard>
        </Link>
    );
};