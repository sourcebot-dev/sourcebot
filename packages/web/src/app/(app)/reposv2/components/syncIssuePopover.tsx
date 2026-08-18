"use client";

import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { indexRepo } from "@/features/repos/actions";
import { cn, isServiceError } from "@/lib/utils";
import { ChevronDown, CircleX, Loader2, RotateCw, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { DisplayDate } from "../../components/DisplayDate";
import { LightweightCodeHighlighter } from "../../components/lightweightCodeHighlighter";
import type { Repo } from "./reposTable";

type SyncIssuePopoverProps = {
    repo: Repo;
    annotation: "WARNING" | "FAILED";
    canRetry: boolean;
    onRetryScheduled: (repoId: number, jobId: string) => void;
};

export const SyncIssuePopover = ({
    repo,
    annotation,
    canRetry,
    onRetryScheduled,
}: SyncIssuePopoverProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);
    const { toast } = useToast();
    const latestJob = repo.latestJob;
    if (!latestJob || latestJob.status !== "FAILED") {
        return null;
    }

    const isWarning = annotation === "WARNING";
    const label = isWarning ? "Warning" : "Failed";
    const Icon = isWarning ? TriangleAlert : CircleX;
    const repoDisplayName = repo.displayName ?? repo.name;

    const retrySync = async () => {
        setIsRetrying(true);

        try {
            const response = await indexRepo(repo.id);
            if (isServiceError(response)) {
                toast({
                    variant: "destructive",
                    title: "Failed to retry sync",
                    description: response.message,
                });
                return;
            }

            onRetryScheduled(repo.id, response.jobId);
            toast({
                title: "Sync scheduled",
                description: `${repoDisplayName} was queued for indexing.`,
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
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            className={cn(
                                badgeVariants({
                                    variant: isWarning ? "outline" : "destructive",
                                }),
                                "shrink-0 cursor-pointer select-none gap-1 rounded-sm hover:shadow-sm focus:ring-0 focus:ring-offset-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                isWarning
                                    && "border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400",
                            )}
                            aria-label={`View ${label.toLowerCase()} details for ${repoDisplayName}`}
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
                    <p>View failure details</p>
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
                                    ? "Latest sync failed"
                                    : "Repository sync failed"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {isWarning
                                    ? "Search remains available using the last successful sync, but results may be stale."
                                    : "This repository has not synced successfully, so its contents are not available in search."}
                            </p>
                        </div>
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
                        <dl className="grid grid-cols-[max-content_minmax(0,1fr)] items-center gap-x-4 gap-y-2 text-xs">
                            {isWarning && repo.indexedAt && (
                                <>
                                    <dt className="text-muted-foreground">
                                        Last successful sync
                                    </dt>
                                    <dd>
                                        <DisplayDate date={repo.indexedAt} />
                                    </dd>
                                </>
                            )}
                            <dt className="text-muted-foreground">Job ID</dt>
                            <dd className="min-w-0 truncate">
                                <code title={latestJob.id}>{latestJob.id}</code>
                            </dd>
                        </dl>
                        {canRetry && (
                            <div className="flex justify-end border-t pt-3">
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
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};
