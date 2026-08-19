"use client";

import { DisplayDate } from "@/app/(app)/components/DisplayDate";
import { JobLogsDialog } from "@/app/(app)/components/jobLogsDialog";
import { LightweightCodeHighlighter } from "@/app/(app)/components/lightweightCodeHighlighter";
import { useToast } from "@/components/hooks/use-toast";
import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { syncConnection } from "@/features/connections/actions";
import { cn, isServiceError } from "@/lib/utils";
import type {
    RepositoryDiscoveryIssue,
    WorkloadJob,
} from "@sourcebot/shared";
import {
    ChevronDown,
    CircleX,
    Loader2,
    RotateCw,
    ScrollText,
    TriangleAlert,
} from "lucide-react";
import { useState } from "react";

type SyncIssuePopoverProps = {
    connection: {
        id: number;
        name: string;
        syncedAt: Date | null;
    };
    latestJob: WorkloadJob<"connection-sync">;
    annotation: "WARNING" | "FAILED";
    onRetryScheduled: (connectionId: number, jobId: string) => void;
};

const DiscoveryIssues = ({
    issues,
}: {
    issues: RepositoryDiscoveryIssue[];
}) => (
    <div className="max-h-64 overflow-auto rounded-md border">
        <div className="divide-y">
            {issues.map((issue, index) => (
                <div
                    key={`${issue.code}:${issue.subject?.kind ?? "connection"}:${issue.subject?.value ?? index}`}
                    className="space-y-1 p-3"
                >
                    {issue.subject && (
                        <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 text-sm">
                            <span className="capitalize text-muted-foreground">
                                {issue.subject.kind}
                            </span>
                            <span className="min-w-0 break-words font-medium">
                                {issue.subject.value}
                            </span>
                        </div>
                    )}
                    <p className="text-sm text-muted-foreground">
                        {issue.message}
                    </p>
                </div>
            ))}
        </div>
    </div>
);

export const SyncIssuePopover = ({
    connection,
    latestJob,
    annotation,
    onRetryScheduled,
}: SyncIssuePopoverProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isLogsOpen, setIsLogsOpen] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);
    const { toast } = useToast();
    const isWarning = annotation === "WARNING";
    const reasons = latestJob.status === "COMPLETED"
        && latestJob.result?.outcome === "PARTIAL_SUCCESS"
        ? latestJob.result.reasons
        : null;
    if (
        (isWarning && !reasons)
        || (!isWarning && latestJob.status !== "FAILED")
    ) {
        return null;
    }

    const label = isWarning ? "Warning" : "Failed";
    const Icon = isWarning ? TriangleAlert : CircleX;

    const retrySync = async () => {
        setIsRetrying(true);

        try {
            const response = await syncConnection(connection.id);
            if (isServiceError(response)) {
                toast({
                    variant: "destructive",
                    title: "Failed to retry sync",
                    description: response.message,
                });
                return;
            }

            onRetryScheduled(connection.id, response.jobId);
            toast({
                title: "Sync scheduled",
                description: `${connection.name} was queued for syncing.`,
            });
            setIsOpen(false);
        } catch {
            toast({
                variant: "destructive",
                title: "Failed to retry sync",
                description: "An unexpected error occurred while scheduling the sync.",
            });
        } finally {
            setIsRetrying(false);
        }
    };

    return (
        <>
            <Popover open={isOpen} onOpenChange={setIsOpen}>
            <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            className={cn(
                                badgeVariants({
                                    variant: isWarning
                                        ? "outline"
                                        : "destructive",
                                }),
                                "shrink-0 cursor-pointer select-none gap-1 rounded-sm hover:shadow-sm focus:ring-0 focus:ring-offset-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                isWarning
                                    && "border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400",
                            )}
                            aria-label={`View ${label.toLowerCase()} details for ${connection.name}`}
                        >
                            <Icon className="h-3 w-3" />
                            {label}
                            <ChevronDown
                                className={cn(
                                    "h-3 w-3 transition-transform",
                                    isOpen && "rotate-180",
                                )}
                            />
                        </button>
                    </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>
                    <p>
                        {isWarning
                            ? "View warning details"
                            : "View failure details"}
                    </p>
                </TooltipContent>
            </Tooltip>
            <PopoverContent
                align="end"
                className="w-[640px] max-w-[calc(100vw-2rem)]"
            >
                <div className="grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-3">
                    <Icon
                        className={cn(
                            "mt-0.5 h-4 w-4",
                            isWarning
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-destructive",
                        )}
                    />
                    <div className="min-w-0 space-y-4">
                        <div className="space-y-1">
                            <p className="text-sm font-medium">
                                {isWarning
                                    ? "Connection sync completed with warnings"
                                    : "Connection sync failed"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {isWarning
                                    ? "Sourcebot could not honor the full configured discovery scope. Some repositories may be missing."
                                    : "Sourcebot could not complete the latest sync for this connection."}
                            </p>
                        </div>
                        {isWarning && reasons
                            ? <DiscoveryIssues issues={reasons} />
                            : (
                                  <div className="space-y-1.5">
                                      <p className="text-xs font-medium text-muted-foreground">
                                          Error
                                      </p>
                                      <div className="max-h-40 overflow-auto rounded-md bg-muted p-2">
                                          <LightweightCodeHighlighter
                                              language="text"
                                              lineNumbers={true}
                                              renderWhitespace={false}
                                              wrapLines={false}
                                          >
                                              {latestJob.errorMessage
                                                  ?? "No error details were reported."}
                                          </LightweightCodeHighlighter>
                                      </div>
                                  </div>
                              )}
                        <dl className="grid grid-cols-[max-content_minmax(0,1fr)] items-center gap-x-4 gap-y-2 text-xs">
                            {connection.syncedAt && (
                                <>
                                    <dt className="text-muted-foreground">
                                        Last synced
                                    </dt>
                                    <dd>
                                        <DisplayDate date={connection.syncedAt} />
                                    </dd>
                                </>
                            )}
                            <dt className="text-muted-foreground">Job ID</dt>
                            <dd className="min-w-0 truncate">
                                <code title={latestJob.id}>{latestJob.id}</code>
                            </dd>
                        </dl>
                        <div className="flex justify-end gap-2 border-t pt-3">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                    setIsOpen(false);
                                    setIsLogsOpen(true);
                                }}
                            >
                                <ScrollText className="h-4 w-4" />
                                View logs
                            </Button>
                            <Button
                                size="sm"
                                onClick={retrySync}
                                disabled={isRetrying}
                            >
                                {isRetrying ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <RotateCw className="h-4 w-4" />
                                )}
                                {isRetrying ? "Retrying…" : "Retry sync"}
                            </Button>
                        </div>
                    </div>
                </div>
                </PopoverContent>
            </Popover>
            <JobLogsDialog
                queue="connection-sync"
                subject={connection.name}
                jobId={latestJob.id}
                open={isLogsOpen}
                onOpenChange={setIsLogsOpen}
            />
        </>
    );
};
