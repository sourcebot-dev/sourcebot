"use client";

import Link from "next/link";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { useDomain } from "@/hooks/useDomain";
import { getConnectionInProgressRepos, getConnections } from "@/actions";
import { isServiceError } from "@/lib/utils";
import useCaptureEvent from "@/hooks/useCaptureEvent";
interface InProgress {
    connectionId: number;
    repoId: number;
    repoName: string;
}


export const ProgressNavIndicator = () => {
    const domain = useDomain();
    const [inProgressJobs, setInProgressJobs] = useState<InProgress[]>([]);
    const captureEvent = useCaptureEvent();

    useEffect(() => {
        const fetchInProgressJobs = async () => {
            const connections = await getConnections(domain);
            if (!isServiceError(connections)) {
                const allInProgressRepos: InProgress[] = [];
                for (const connection of connections) {
                    const inProgressRepos = await getConnectionInProgressRepos(connection.id, domain);
                    if (!isServiceError(inProgressRepos)) {
                        allInProgressRepos.push(...inProgressRepos.map(repo => ({
                            connectionId: connection.id,
                            ...repo
                        })));
                    } else {
                        captureEvent('wa_progress_nav_job_fetch_fail', {
                            error: inProgressRepos.errorCode,
                        });
                    }
                }
                setInProgressJobs(prevJobs => {
                    // Only update if the jobs have actually changed
                    const jobsChanged = prevJobs.length !== allInProgressRepos.length || 
                        prevJobs.some((job, idx) => 
                            job.repoId !== allInProgressRepos[idx]?.repoId ||
                            job.repoName !== allInProgressRepos[idx]?.repoName
                        );
                    return jobsChanged ? allInProgressRepos : prevJobs;
                });
            } else {
                captureEvent('wa_progress_nav_connection_fetch_fail', {
                    error: connections.errorCode,
                });
            }
        };

        fetchInProgressJobs();
    }, [domain, captureEvent]);

    if (inProgressJobs.length === 0) {
        return null;
    }

    return (
        <Link href={`/${domain}/connections`} onClick={() => captureEvent('wa_progress_nav_pressed', {})}>
            <HoverCard openDelay={50}>
                <HoverCardTrigger asChild onMouseEnter={() => captureEvent('wa_progress_nav_hover', {})}>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-full text-green-700 dark:text-green-400 text-xs font-medium hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors cursor-pointer">
                        <Loader2Icon className="h-4 w-4 animate-spin" />
                        <span>{inProgressJobs.length}</span>
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
                            {inProgressJobs.slice(0, 10).map(item => (
                                <Link key={item.repoId} href={`/${domain}/connections/${item.connectionId}`} onClick={() => captureEvent('wa_progress_nav_job_pressed', {})}>
                                    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 
                                                rounded-md text-sm text-green-700 dark:text-green-300 
                                                border border-green-200/50 dark:border-green-800/50
                                                hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
                                        <span className="font-medium truncate">{item.repoName}</span>
                                    </div>
                                </Link>
                            ))}
                            {inProgressJobs.length > 10 && (
                                <div className="text-sm text-green-600/90 dark:text-green-300/90 pl-3 pt-1">
                                    And {inProgressJobs.length - 10} more...
                                </div>
                            )}
                        </div>
                    </div>
                </HoverCardContent>
            </HoverCard>
        </Link>
    );
};