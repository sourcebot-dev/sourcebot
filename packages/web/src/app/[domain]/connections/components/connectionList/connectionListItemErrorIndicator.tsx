'use client'

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { CircleX } from "lucide-react";
import useCaptureEvent from "@/hooks/useCaptureEvent";

interface ConnectionListItemErrorIndicatorProps {
    failedRepos: { repoId: number; repoName: string; }[] | undefined;
    connectionId: string;
}

export const ConnectionListItemErrorIndicator = ({
    failedRepos,
    connectionId
}: ConnectionListItemErrorIndicatorProps) => {
    const captureEvent = useCaptureEvent()
    
    if (!failedRepos || failedRepos.length === 0) return null;

    return (
        <HoverCard openDelay={50}>
            <HoverCardTrigger asChild>
                <CircleX 
                    className="h-5 w-5 text-red-700 dark:text-red-400 cursor-help hover:text-red-600 dark:hover:text-red-300 transition-colors" 
                    onClick={() => {
                        captureEvent('wa_connection_list_item_error_pressed', {})
                        window.location.href = `connections/${connectionId}`
                    }}
                    onMouseEnter={() => captureEvent('wa_connection_list_item_error_hover', {})}
                />
            </HoverCardTrigger>
            <HoverCardContent className="w-80 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex flex-col space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-red-200 dark:border-red-800">
                        <CircleX className="h-4 w-4 text-red-700 dark:text-red-400" />
                        <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Failed to Index Repositories</h3>
                    </div>
                    <div className="text-sm text-red-600/90 dark:text-red-300/90 space-y-3">
                        <p>
                            {failedRepos.length} {failedRepos.length === 1 ? 'repository' : 'repositories'} failed to index. This is likely due to temporary server load.
                        </p>
                        <div className="space-y-2 text-sm bg-red-50 dark:bg-red-900/20 rounded-md p-3 border border-red-200/50 dark:border-red-800/50">
                            <div className="flex flex-col gap-1.5">
                                {failedRepos.slice(0, 10).map(repo => (
                                    <span key={repo.repoId} className="text-red-700 dark:text-red-300">{repo.repoName}</span>
                                ))}
                                {failedRepos.length > 10 && (
                                    <span className="text-red-600/75 dark:text-red-400/75 text-xs pt-1">
                                        And {failedRepos.length - 10} more...
                                    </span>
                                )}
                            </div>
                        </div>
                        <p className="text-xs">
                            Navigate to the connection for more details and to retry indexing.
                        </p>
                    </div>
                </div>
            </HoverCardContent>
        </HoverCard>
    );
};
