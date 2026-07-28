"use client";

import { DisplayDate } from "@/app/(app)/components/DisplayDate";
import { useToast } from "@/components/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { syncConnection } from "@/features/workerApi/actions";
import { cn, getCodeHostIcon, isServiceError } from "@/lib/utils";
import { ConnectionType } from "@sourcebot/db";
import { AlertCircle, CheckCircle2, CircleDashed, FileText, MoreHorizontal, RefreshCw, Search } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ConnectionSyncLogsDialog } from "./connectionSyncLogsDialog";
import { WorkloadJob } from "@sourcebot/shared";

const SYNC_STATUS_POLL_INTERVAL_MS = 1000;

export type ConnectionV2 = {
    id: number;
    name: string;
    connectionType: ConnectionType;
    syncedAt: Date | null;
    currentJob: WorkloadJob<'connection'> | null;
};

const getConnectionStatus = (connection: ConnectionV2) => {
    switch (connection.currentJob?.status) {
        case "PENDING":
            return {
                key: "syncing",
                label: "Queued",
                icon: <CircleDashed className="h-3.5 w-3.5 animate-spin" />,
                className: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
            };
        case "IN_PROGRESS":
            return {
                key: "syncing",
                label: "Syncing",
                icon: <CircleDashed className="h-3.5 w-3.5 animate-spin" />,
                className: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
            };
        case "FAILED":
            return {
                key: "failed",
                label: "Sync failed",
                icon: <AlertCircle className="h-3.5 w-3.5" />,
                className: "border-destructive/30 bg-destructive/10 text-destructive",
            };
        case "COMPLETED":
            return {
                key: "healthy",
                label: "Healthy",
                icon: <CheckCircle2 className="h-3.5 w-3.5" />,
                className: "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300",
            };
        default:
            return connection.syncedAt
                ? {
                    key: "healthy",
                    label: "Healthy",
                    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
                    className: "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300",
                }
                : {
                    key: "not-synced",
                    label: "Never synced",
                    icon: <CircleDashed className="h-3.5 w-3.5" />,
                    className: "border-border bg-muted text-muted-foreground",
                };
    }
};

const ConnectionRow = ({ connection }: { connection: ConnectionV2 }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submittedJobId, setSubmittedJobId] = useState<string | null>(null);
    const [isLogsOpen, setIsLogsOpen] = useState(false);
    const router = useRouter();
    const { toast } = useToast();
    const codeHostIcon = getCodeHostIcon(connection.connectionType);
    const isRunning = connection.currentJob?.status === "PENDING" ||
        connection.currentJob?.status === "IN_PROGRESS";
    const isSubmittedJobSettled = connection.currentJob?.id === submittedJobId &&
        (connection.currentJob.status === "COMPLETED" || connection.currentJob.status === "FAILED");
    const isSyncRunning = isSubmitting || isRunning || (submittedJobId !== null && !isSubmittedJobSettled);
    const status = isSyncRunning && !isRunning
        ? {
            key: "syncing",
            label: "Syncing",
            icon: <CircleDashed className="h-3.5 w-3.5 animate-spin" />,
            className: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
        }
        : getConnectionStatus(connection);

    useEffect(() => {
        if (!isSyncRunning) {
            return;
        }

        const interval = window.setInterval(() => {
            router.refresh();
        }, SYNC_STATUS_POLL_INTERVAL_MS);

        return () => {
            window.clearInterval(interval);
        };
    }, [isSyncRunning, router]);

    const onSync = async () => {
        setIsSubmitting(true);
        try {
            const result = await syncConnection(connection.id);
            if (isServiceError(result)) {
                toast({
                    description: `❌ Failed to sync connection. ${result.message}`,
                });
                return;
            }

            setSubmittedJobId(result.jobId);
            toast({
                description: `✅ Connection sync triggered. Job ID: ${result.jobId}`,
            });
            router.refresh();
        } catch {
            toast({
                description: "❌ Failed to sync connection.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <div className="grid gap-4 px-5 py-4 md:grid-cols-[minmax(0,1fr)_minmax(180px,0.6fr)_minmax(180px,0.6fr)_auto] md:items-center">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-background">
                        <Image
                            src={codeHostIcon.src}
                            alt={`${connection.connectionType} logo`}
                            className={codeHostIcon.className}
                            width={22}
                            height={22}
                        />
                    </div>
                    <div className="min-w-0">
                        <p className="truncate font-medium">{connection.name}</p>
                        <p className="text-sm capitalize text-muted-foreground">{connection.connectionType}</p>
                    </div>
                </div>

                <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current status</p>
                    <Badge variant="outline" className={cn(status.className, "gap-1.5")}>
                        {status.icon}
                        {status.label}
                    </Badge>
                    {connection.currentJob?.status === "FAILED" && connection.currentJob.errorMessage && (
                        <p className="line-clamp-1 text-xs text-destructive">{connection.currentJob.errorMessage}</p>
                    )}
                </div>

                <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last successful sync</p>
                    <p className="text-sm">
                        {connection.syncedAt
                            ? <DisplayDate date={connection.syncedAt} />
                            : <span className="text-muted-foreground">Not yet synced</span>}
                    </p>
                </div>

                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="justify-self-start md:justify-self-end"
                            aria-label={`Open actions for ${connection.name}`}
                        >
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem
                            disabled={!connection.currentJob}
                            onSelect={() => {
                                setIsLogsOpen(true);
                            }}
                        >
                            <FileText className="mr-1.5 h-4 w-4" />
                            View logs
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            disabled={isSyncRunning}
                            onClick={() => {
                                void onSync();
                            }}
                        >
                            <RefreshCw className={cn("mr-1.5 h-4 w-4", isSyncRunning && "animate-spin")} />
                            {isSyncRunning ? "Sync in progress" : "Trigger sync"}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <ConnectionSyncLogsDialog
                connectionId={connection.id}
                connectionName={connection.name}
                jobId={connection.currentJob?.id ?? null}
                open={isLogsOpen}
                onOpenChange={setIsLogsOpen}
            />
        </>
    );
};

export const ConnectionsList = ({ data }: { data: ConnectionV2[] }) => {
    const [query, setQuery] = useState("");
    const healthyCount = useMemo(
        () => data.filter((connection) => getConnectionStatus(connection).key === "healthy").length,
        [data],
    );
    const filteredConnections = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        return data.filter((connection) => (
            normalizedQuery.length === 0 ||
                connection.name.toLowerCase().includes(normalizedQuery) ||
                connection.connectionType.toLowerCase().includes(normalizedQuery)
        ));
    }, [data, query]);

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative w-full sm:max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search connections..."
                        className="pl-9"
                    />
                </div>
                <p className="text-sm text-muted-foreground sm:ml-auto">
                    {healthyCount} healthy · {data.length} total
                </p>
            </div>

            <div className="overflow-hidden rounded-lg border bg-card">
                {filteredConnections.length > 0 ? filteredConnections.map((connection, index) => (
                    <div key={connection.id} className={index > 0 ? "border-t" : undefined}>
                        <ConnectionRow connection={connection} />
                    </div>
                )) : (
                    <div className="px-6 py-16 text-center">
                        <p className="font-medium">{data.length === 0 ? "No code host connections" : "No matching connections"}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {data.length === 0
                                ? "Add a connection to begin syncing repositories."
                                : "Try changing your search."}
                        </p>
                    </div>
                )}
            </div>

            {filteredConnections.length > 0 && (
                <p className="text-sm text-muted-foreground">
                    Showing {filteredConnections.length} of {data.length} {data.length === 1 ? "connection" : "connections"}
                </p>
            )}
        </div>
    );
};
