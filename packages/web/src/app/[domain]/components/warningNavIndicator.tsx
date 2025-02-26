"use client";

import Link from "next/link";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { AlertTriangleIcon } from "lucide-react";
import { useDomain } from "@/hooks/useDomain";
import { getConnections } from "@/actions";
import { isServiceError } from "@/lib/utils";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { NEXT_PUBLIC_POLLING_INTERVAL_MS } from "@/lib/environment.client";
import { useQuery } from "@tanstack/react-query";
import { ConnectionSyncStatus } from "@prisma/client";

export const WarningNavIndicator = () => {
    const domain = useDomain();
    const captureEvent = useCaptureEvent();

    const { data: connections } = useQuery({
        queryKey: ['connections', domain],
        queryFn: () => getConnections(domain),
        select: (data) => {
            if (isServiceError(data)) {
                return data;
            }
            return data.filter(connection => connection.syncStatus === ConnectionSyncStatus.SYNCED_WITH_WARNINGS);
        },
        refetchInterval: NEXT_PUBLIC_POLLING_INTERVAL_MS,
        initialData: [],
    });

    if (isServiceError(connections) || connections.length === 0) {
        return null;
    }   

    return (
        <Link href={`/${domain}/connections`} onClick={() => captureEvent('wa_warning_nav_pressed', {})}>
            <HoverCard openDelay={50}>
                <HoverCardTrigger asChild onMouseEnter={() => captureEvent('wa_warning_nav_hover', {})}>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-full text-yellow-700 dark:text-yellow-400 text-xs font-medium hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors cursor-pointer">
                        <AlertTriangleIcon className="h-4 w-4" />
                        <span>{connections.length}</span>
                    </div>
                </HoverCardTrigger>
                <HoverCardContent className="w-80 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex flex-col gap-4 p-5">
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                            <h3 className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Missing References</h3>
                        </div>
                        <p className="text-sm text-yellow-600/90 dark:text-yellow-300/90 leading-relaxed">
                            The following connections have references that could not be found:
                        </p>
                        <div className="flex flex-col gap-2 pl-4">
                            {connections.slice(0, 10).map(connection => (
                                <Link key={connection.name} href={`/${domain}/connections/${connection.id}`} onClick={() => captureEvent('wa_warning_nav_connection_pressed', {})}>
                                    <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 
                                                rounded-md text-sm text-yellow-700 dark:text-yellow-300 
                                                border border-yellow-200/50 dark:border-yellow-800/50
                                                hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors">
                                        <span className="font-medium">{connection.name}</span>
                                    </div>
                                </Link>
                            ))}
                            {connections.length > 10 && (
                                <div className="text-sm text-yellow-600/90 dark:text-yellow-300/90 pl-3 pt-1">
                                    And {connections.length - 10} more...
                                </div>
                            )}
                        </div>
                    </div>
                </HoverCardContent>
            </HoverCard>
        </Link>
    );
};
