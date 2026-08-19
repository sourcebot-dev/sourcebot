"use client";

import { CopyIconButton } from "@/app/(app)/components/copyIconButton";
import {
    getJobLogs,
} from "@/app/api/(client)/client";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import type { JobLogEntry, JobLogLevel, QueueName } from "@sourcebot/shared";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Loader2 } from "lucide-react";
import { useRef, useState } from "react";

type JobLogsDialogProps = {
    queue: QueueName;
    subject: string;
    jobId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

const timestampFormatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    timeZoneName: "short",
    hourCycle: "h23",
});

const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) {
        return "Unknown time";
    }

    const date = new Date(timestamp);
    return Number.isNaN(date.getTime())
        ? timestamp
        : timestampFormatter.format(date).replace(",", "");
};

const formatLogLine = (entry: JobLogEntry) => {
    const fields = entry.fields
        ? ` ${JSON.stringify(entry.fields)}`
        : "";
    return `${formatTimestamp(entry.timestamp)} ${entry.level.toUpperCase()} ${entry.message}${fields}`;
};

const levelStyles: Record<
    JobLogLevel,
    { dot: string; text: string }
> = {
    debug: {
        dot: "bg-muted-foreground",
        text: "text-muted-foreground",
    },
    info: {
        dot: "bg-blue-500",
        text: "text-blue-600 dark:text-blue-400",
    },
    warn: {
        dot: "bg-amber-500",
        text: "text-amber-700 dark:text-amber-400",
    },
    error: {
        dot: "bg-destructive",
        text: "text-destructive",
    },
};

const LogLevel = ({ level }: { level: JobLogLevel }) => (
    <span
        className={`flex h-5 items-center gap-1.5 font-mono text-[11px] font-medium uppercase leading-5 ${levelStyles[level].text}`}
    >
        <span
            className={`h-1.5 w-1.5 rounded-full ${levelStyles[level].dot}`}
        />
        {level}
    </span>
);

export const JobLogsDialog = ({
    queue,
    subject,
    jobId,
    open,
    onOpenChange,
}: JobLogsDialogProps) => {
    const titleRef = useRef<HTMLHeadingElement>(null);
    const [copiedAll, setCopiedAll] = useState(false);
    const { data, isPending, isError } = useQuery({
        queryKey: ["job-logs", queue, jobId],
        queryFn: ({ signal }) =>
            getJobLogs(queue, jobId, signal),
        enabled: open,
    });
    const latestAttempt = data?.logs.reduce<number | null>(
        (latest, entry) => entry.attempt === null
            ? latest
            : Math.max(latest ?? entry.attempt, entry.attempt),
        null,
    ) ?? null;
    const displayedLogs = latestAttempt === null
        ? data?.logs ?? []
        : data?.logs.filter((entry) => entry.attempt === latestAttempt) ?? [];

    const copyAllLogs = async () => {
        try {
            await navigator.clipboard.writeText(
                displayedLogs.map(formatLogLine).join("\n"),
            );
            setCopiedAll(true);
            setTimeout(() => setCopiedAll(false), 2_000);
        } catch {
            setCopiedAll(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="flex h-[90dvh] max-h-[90dvh] w-[90vw] max-w-[90vw] flex-col overflow-hidden"
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    titleRef.current?.focus();
                }}
            >
                <DialogHeader className="shrink-0 pr-8">
                    <div className="flex min-w-0 items-start justify-between gap-4">
                        <div className="min-w-0 space-y-1.5">
                            <DialogTitle
                                ref={titleRef}
                                tabIndex={-1}
                                className="focus:outline-none"
                            >
                                Job logs
                            </DialogTitle>
                            <DialogDescription className="truncate">
                                {subject} · <code title={jobId}>{jobId}</code>
                            </DialogDescription>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 shrink-0"
                            disabled={isPending || isError || displayedLogs.length === 0}
                            onClick={() => void copyAllLogs()}
                        >
                            {copiedAll
                                ? <Check className="text-green-500" />
                                : <Copy />}
                            {copiedAll ? "Copied" : "Copy all"}
                        </Button>
                    </div>
                </DialogHeader>
                <div className="relative min-h-0 flex-1 overflow-hidden rounded-md bg-background">
                    <div className="h-full overflow-auto">
                        <table className="w-full table-fixed border-collapse text-left">
                        <colgroup>
                            <col className="w-56" />
                            <col className="w-28" />
                            <col />
                        </colgroup>
                        <thead>
                            <tr className="border-b">
                                {[
                                    "Time",
                                    "Level",
                                    "Message",
                                ].map((heading) => (
                                    <th
                                        key={heading}
                                        className="sticky top-0 z-10 h-9 bg-muted px-3 text-xs font-medium text-muted-foreground"
                                    >
                                        {heading}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {isPending
                                ? (
                                      <tr>
                                          <td colSpan={3} className="h-64">
                                              <div className="flex items-center justify-center text-muted-foreground">
                                                  <Loader2 className="h-5 w-5 animate-spin" />
                                                  <span className="sr-only">
                                                      Loading job logs
                                                  </span>
                                              </div>
                                          </td>
                                      </tr>
                                  )
                                : isError
                                    ? (
                                          <tr>
                                              <td
                                                  colSpan={3}
                                                  className="h-64 text-center text-sm text-destructive"
                                              >
                                                  Failed to load job logs.
                                              </td>
                                          </tr>
                                      )
                                    : displayedLogs.length > 0
                                        ? displayedLogs.map((entry, index) => (
                                              <tr
                                                  key={`${entry.timestamp ?? "legacy"}:${index}`}
                                                  className="group border-b align-top transition-colors last:border-b-0 hover:bg-muted/30"
                                              >
                                                  <td className="align-top whitespace-nowrap px-3 py-2.5 font-mono text-[11px] leading-5 text-muted-foreground">
                                                      <time
                                                          dateTime={entry.timestamp ?? undefined}
                                                          title={entry.timestamp ?? undefined}
                                                      >
                                                          {formatTimestamp(
                                                              entry.timestamp,
                                                          )}
                                                      </time>
                                                  </td>
                                                  <td className="align-top px-3 py-2.5">
                                                      <LogLevel
                                                          level={entry.level}
                                                      />
                                                  </td>
                                                  <td className="relative min-w-0 align-top px-3 py-2.5 pr-11 font-mono text-xs leading-5 text-foreground">
                                                      <div className="whitespace-pre-wrap break-words">
                                                          {entry.message}
                                                          {entry.fields && (
                                                              <span className="text-muted-foreground">
                                                                  {` ${JSON.stringify(entry.fields)}`}
                                                              </span>
                                                          )}
                                                      </div>
                                                      <CopyIconButton
                                                          className="absolute right-2 top-2 opacity-0 shadow-sm transition-opacity hover:bg-background focus:opacity-100 group-hover:opacity-100"
                                                          onCopy={() => {
                                                              try {
                                                                  void navigator.clipboard.writeText(
                                                                      formatLogLine(
                                                                          entry,
                                                                      ),
                                                                  );
                                                                  return true;
                                                              } catch {
                                                                  return false;
                                                              }
                                                          }}
                                                      />
                                                  </td>
                                              </tr>
                                          ))
                                        : (
                                              <tr>
                                                  <td
                                                      colSpan={3}
                                                      className="h-64 text-center text-sm text-muted-foreground"
                                                  >
                                                      No logs were recorded for this job.
                                                  </td>
                                              </tr>
                                          )}
                        </tbody>
                        </table>
                    </div>
                    <div className="pointer-events-none absolute inset-0 z-20 rounded-md ring-1 ring-inset ring-border" />
                </div>
            </DialogContent>
        </Dialog>
    );
};
