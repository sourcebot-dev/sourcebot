"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { getConnectionSyncJobLogs } from "@/features/workerApi/actions";
import { cn, isServiceError } from "@/lib/utils";
import type { JobLogEntry, JobLogLevel } from "@sourcebot/shared";
import { Loader2, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const LOG_POLL_INTERVAL_MS = 1000;

const JOB_LOG_LEVEL_CLASS_NAMES: Record<JobLogLevel, string> = {
    debug: "text-muted-foreground",
    info: "text-blue-600 dark:text-blue-400",
    warn: "text-amber-600 dark:text-amber-400",
    error: "text-destructive",
};

const formatLogTimestamp = (timestamp: string | null) => {
    if (!timestamp) {
        return "—";
    }
    return new Date(timestamp).toLocaleTimeString();
};

type ConnectionSyncLogsDialogProps = {
    connectionId: number;
    connectionName: string;
    jobId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export const ConnectionSyncLogsDialog = ({
    connectionId,
    connectionName,
    jobId,
    open,
    onOpenChange,
}: ConnectionSyncLogsDialogProps) => {
    const [logs, setLogs] = useState<JobLogEntry[]>([]);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [logsError, setLogsError] = useState<string | null>(null);
    const pollNowRef = useRef<() => void>(() => undefined);

    useEffect(() => {
        if (!open || !jobId) {
            return;
        }

        let cursor = 0;
        let isCancelled = false;
        let isRequestInFlight = false;

        setLogs([]);
        setHasLoaded(false);
        setLogsError(null);

        const poll = async () => {
            if (isRequestInFlight) {
                return;
            }

            isRequestInFlight = true;
            setIsRefreshing(true);

            try {
                const result = await getConnectionSyncJobLogs(
                    connectionId,
                    jobId,
                    cursor,
                );
                if (isCancelled) {
                    return;
                }
                if (isServiceError(result)) {
                    setLogsError(result.message);
                    return;
                }

                setLogsError(null);
                setLogs((currentLogs) => (
                    result.count < cursor
                        ? result.logs
                        : [...currentLogs, ...result.logs]
                ));
                cursor = result.count;
            } catch {
                if (!isCancelled) {
                    setLogsError("Failed to load logs for this sync.");
                }
            } finally {
                if (!isCancelled) {
                    setHasLoaded(true);
                    setIsRefreshing(false);
                }
                isRequestInFlight = false;
            }
        };

        const pollNow = () => {
            void poll();
        };
        pollNowRef.current = pollNow;

        pollNow();
        const interval = window.setInterval(pollNow, LOG_POLL_INTERVAL_MS);

        return () => {
            isCancelled = true;
            window.clearInterval(interval);
            if (pollNowRef.current === pollNow) {
                pollNowRef.current = () => undefined;
            }
        };
    }, [connectionId, jobId, open]);

    const isInitialLoading = !hasLoaded && isRefreshing;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[80vh] max-w-3xl flex-col overflow-hidden">
                <div className="flex items-start justify-between gap-4 pr-8">
                    <DialogHeader>
                        <DialogTitle>{connectionName} sync logs</DialogTitle>
                        <DialogDescription>
                            Latest sync job {jobId}. Logs update automatically while this dialog is open.
                        </DialogDescription>
                    </DialogHeader>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={isRefreshing}
                        onClick={() => {
                            pollNowRef.current();
                        }}
                    >
                        <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                        Refresh
                    </Button>
                </div>

                <div
                    className="min-h-48 overflow-y-auto rounded-md border bg-muted/20"
                    aria-live="polite"
                >
                    {isInitialLoading ? (
                        <div className="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading logs…
                        </div>
                    ) : logs.length > 0 ? (
                        <>
                            {logsError && (
                                <div className="border-b px-4 py-2 text-xs text-destructive">
                                    {logsError}
                                </div>
                            )}
                            <div className="divide-y font-mono text-xs">
                                {logs.map((entry, index) => (
                                    <div
                                        key={`${entry.timestamp ?? "legacy"}-${index}`}
                                        className="flex items-baseline gap-3 px-4 py-2.5"
                                    >
                                        <span
                                            className="shrink-0 text-muted-foreground"
                                            title={entry.timestamp ?? undefined}
                                        >
                                            {formatLogTimestamp(entry.timestamp)}
                                        </span>
                                        <span className={cn(
                                            "w-12 shrink-0 font-semibold uppercase",
                                            JOB_LOG_LEVEL_CLASS_NAMES[entry.level],
                                        )}>
                                            {entry.level}
                                        </span>
                                        <p className="min-w-0 whitespace-pre-wrap break-words">{entry.message}</p>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : logsError ? (
                        <div className="flex h-48 items-center justify-center px-6 text-center text-sm text-destructive">
                            {logsError}
                        </div>
                    ) : (
                        <div className="flex h-48 items-center justify-center px-6 text-center text-sm text-muted-foreground">
                            No logs were recorded for this job.
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
