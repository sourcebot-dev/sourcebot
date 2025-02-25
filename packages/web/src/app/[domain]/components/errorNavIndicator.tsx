"use client";

import Link from "next/link";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { CircleXIcon } from "lucide-react";
import { useDomain } from "@/hooks/useDomain";
import { getConnectionFailedRepos, getConnections } from "@/actions";
import { useState, useEffect } from "react";
import { isServiceError } from "@/lib/utils";
import useCaptureEvent from "@/hooks/useCaptureEvent";

enum ConnectionErrorType {
    SYNC_FAILED = "SYNC_FAILED",
    REPO_INDEXING_FAILED = "REPO_INDEXING_FAILED",
}

interface Error {
    connectionId?: number;
    connectionName?: string;
    errorType: ConnectionErrorType;
    numRepos?: number;
}

export const ErrorNavIndicator = () => {
    const domain = useDomain();
    const [errors, setErrors] = useState<Error[]>([]);
    const captureEvent = useCaptureEvent();

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
                    if (!isServiceError(failedRepos)) {
                        if (failedRepos.length > 0) {
                            errors.push({
                                connectionId: connection.id,
                                connectionName: connection.name,
                                numRepos: failedRepos.length,
                                errorType: ConnectionErrorType.REPO_INDEXING_FAILED
                            });
                        }
                    } else {
                        captureEvent('wa_error_nav_job_fetch_fail', {
                            error: failedRepos.errorCode,
                        });
                    }
                }
            } else {
                captureEvent('wa_error_nav_connection_fetch_fail', {
                    error: connections.errorCode,
                });
            }
            setErrors(prevErrors => {
                // Only update if the errors have actually changed
                const errorsChanged = prevErrors.length !== errors.length ||
                    prevErrors.some((error, idx) =>
                        error.connectionId !== errors[idx]?.connectionId ||
                        error.connectionName !== errors[idx]?.connectionName ||
                        error.errorType !== errors[idx]?.errorType
                    );
                return errorsChanged ? errors : prevErrors;
            });
        };

        fetchErrors();
    }, [domain, captureEvent]);

    if (errors.length === 0) return null;

    return (
        <Link href={`/${domain}/connections`} onClick={() => captureEvent('wa_error_nav_pressed', {})}>
            <HoverCard openDelay={50}>
                <HoverCardTrigger asChild onMouseEnter={() => captureEvent('wa_error_nav_hover', {})}>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-full text-red-700 dark:text-red-400 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors cursor-pointer">
                        <CircleXIcon className="h-4 w-4" />
                        {errors.reduce((acc, error) => acc + (error.numRepos || 0), 0) > 0 && (
                            <span>{errors.reduce((acc, error) => acc + (error.numRepos || 0), 0)}</span>
                        )}
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
                                    {errors
                                        .filter(e => e.errorType === 'SYNC_FAILED')
                                        .slice(0, 10)
                                        .map(error => (
                                            <Link key={error.connectionName} href={`/${domain}/connections/${error.connectionId}`} onClick={() => captureEvent('wa_error_nav_job_pressed', {})}>
                                                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 
                                                            rounded-md text-sm text-red-700 dark:text-red-300 
                                                            border border-red-200/50 dark:border-red-800/50
                                                            hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                                                    <span className="font-medium">{error.connectionName}</span>
                                                </div>
                                            </Link>
                                        ))}
                                    {errors.filter(e => e.errorType === 'SYNC_FAILED').length > 10 && (
                                        <div className="text-sm text-red-600/90 dark:text-red-300/90 pl-3 pt-1">
                                            And {errors.filter(e => e.errorType === 'SYNC_FAILED').length - 10} more...
                                        </div>
                                    )}
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
                                    {errors
                                        .filter(e => e.errorType === 'REPO_INDEXING_FAILED')
                                        .slice(0, 10)
                                        .map(error => (
                                            <Link key={error.connectionName} href={`/${domain}/connections/${error.connectionId}`} onClick={() => captureEvent('wa_error_nav_job_pressed', {})}>
                                                <div className="flex items-center justify-between px-3 py-2 
                                                            bg-red-50 dark:bg-red-900/20 rounded-md
                                                            border border-red-200/50 dark:border-red-800/50
                                                            hover:bg-red-100 dark:hover:bg-red-900/30 
                                                            transition-colors">
                                                    <span className="text-sm font-medium text-red-700 dark:text-red-300">
                                                        {error.connectionName}
                                                    </span>
                                                    <span className="text-xs font-medium px-2.5 py-1 rounded-full
                                                                bg-red-100/80 dark:bg-red-800/60
                                                                text-red-600 dark:text-red-300">
                                                        {error.numRepos}
                                                    </span>
                                                </div>
                                            </Link>
                                        ))}
                                    {errors.filter(e => e.errorType === 'REPO_INDEXING_FAILED').length > 10 && (
                                        <div className="text-sm text-red-600/90 dark:text-red-300/90 pl-3 pt-1">
                                            And {errors.filter(e => e.errorType === 'REPO_INDEXING_FAILED').length - 10} more...
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </HoverCardContent>
            </HoverCard>
        </Link>
    );
};
