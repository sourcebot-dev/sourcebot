import { Badge } from "@/components/ui/badge";
import type { WorkloadJob } from "@sourcebot/shared";
import { Check, Loader2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { SyncIssuePopover } from "./syncIssuePopover";

const COMPLETED_BADGE_VISIBLE_MS = 5_000;

type SyncAnnotationProps = {
    connectionId: number;
    latestJob: WorkloadJob<"connection-sync"> | null;
    showCompleted: boolean;
    connectionName: string;
    syncedAt: Date | null;
    onRetryScheduled: (connectionId: number, jobId: string) => void;
};

export type ConnectionSyncAnnotation =
    | "SYNCING"
    | "WARNING"
    | "FAILED"
    | null;

export const getConnectionSyncAnnotation = (
    connectionId: number,
    latestJob: WorkloadJob<"connection-sync"> | null,
    syncedAt: Date | null,
): ConnectionSyncAnnotation => {
    if (!latestJob || latestJob.data.connectionId !== connectionId) {
        return null;
    }

    if (
        latestJob.status === "PENDING"
        || latestJob.status === "IN_PROGRESS"
    ) {
        return "SYNCING";
    }

    if (latestJob.status === "FAILED") {
        return syncedAt ? "WARNING" : "FAILED";
    }

    if (
        latestJob.status === "COMPLETED"
        && latestJob.result?.outcome === "PARTIAL_SUCCESS"
    ) {
        return "WARNING";
    }

    return null;
};

export const SyncAnnotation = ({
    connectionId,
    latestJob,
    showCompleted,
    connectionName,
    syncedAt,
    onRetryScheduled,
}: SyncAnnotationProps) => {
    const prefersReducedMotion = useReducedMotion();
    const completionKey = showCompleted
        ? latestJob?.id ?? `connection:${connectionId}`
        : null;
    const [expiredCompletionKey, setExpiredCompletionKey] = useState<
        string | null
    >(null);
    useEffect(() => {
        if (!completionKey || expiredCompletionKey === completionKey) {
            return;
        }

        const timeout = window.setTimeout(() => {
            setExpiredCompletionKey(completionKey);
        }, COMPLETED_BADGE_VISIBLE_MS);
        return () => window.clearTimeout(timeout);
    }, [completionKey, expiredCompletionKey]);
    const annotation = completionKey !== null
        && expiredCompletionKey !== completionKey
        ? "COMPLETED"
        : getConnectionSyncAnnotation(connectionId, latestJob, syncedAt);
    const badge = (() => {
        switch (annotation) {
            case "COMPLETED":
                return (
                    <Badge className="shrink-0 gap-1 rounded-sm bg-green-600 text-white hover:bg-green-700">
                        <Check className="h-3 w-3" />
                        Completed
                    </Badge>
                );
            case "SYNCING":
                return (
                    <Badge variant="secondary" className="shrink-0 gap-1 rounded-sm">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Syncing
                    </Badge>
                );
            case "FAILED":
                return latestJob
                    ? (
                          <SyncIssuePopover
                              connection={{
                                  id: connectionId,
                                  name: connectionName,
                                  syncedAt,
                              }}
                              latestJob={latestJob}
                              annotation="FAILED"
                              onRetryScheduled={onRetryScheduled}
                          />
                      )
                    : null;
            case "WARNING":
                return latestJob
                    ? (
                          <SyncIssuePopover
                              connection={{
                                  id: connectionId,
                                  name: connectionName,
                                  syncedAt,
                              }}
                              latestJob={latestJob}
                              annotation="WARNING"
                              onRetryScheduled={onRetryScheduled}
                          />
                      )
                    : null;
            default:
                return null;
        }
    })();
    const isCompleted = annotation === "COMPLETED";

    return (
        <AnimatePresence initial={false} mode="wait">
            {annotation && badge && (
                <motion.div
                    key={annotation}
                    initial={prefersReducedMotion
                        ? false
                        : isCompleted
                            ? {
                                  opacity: 1,
                                  clipPath: "inset(0 0 0 100%)",
                              }
                            : { opacity: 0 }}
                    animate={{
                        opacity: 1,
                        clipPath: "inset(0 0 0 0%)",
                    }}
                    exit={{
                        opacity: 0,
                        transition: {
                            duration: prefersReducedMotion ? 0 : 0.15,
                        },
                    }}
                    transition={{
                        duration: prefersReducedMotion ? 0 : 0.35,
                        ease: [0.22, 1, 0.36, 1],
                    }}
                    className="shrink-0"
                >
                    {badge}
                </motion.div>
            )}
        </AnimatePresence>
    );
};
