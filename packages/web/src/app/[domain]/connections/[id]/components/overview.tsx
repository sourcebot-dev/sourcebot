'use client';

import useCaptureEvent from "@/hooks/useCaptureEvent";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { DisplayConnectionError } from "./connectionError"
import { NotFoundWarning } from "./notFoundWarning"
import { useDomain } from "@/hooks/useDomain";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { flagConnectionForSync, getConnectionInfo } from "@/actions";
import { isServiceError, unwrapServiceError } from "@/lib/utils";
import { NEXT_PUBLIC_POLLING_INTERVAL_MS } from "@/lib/environment.client";
import { ConnectionSyncStatus } from "@sourcebot/db";
import { FiLoader } from "react-icons/fi";
import { CircleCheckIcon, AlertTriangle, CircleXIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReloadIcon } from "@radix-ui/react-icons";
import { toast } from "@/components/hooks/use-toast";

interface OverviewProps {
    connectionId: number;
}

export const Overview = ({ connectionId }: OverviewProps) => {
    const captureEvent = useCaptureEvent();
    const domain = useDomain();
    const router = useRouter();

    const { data: connection, isPending, error, refetch } = useQuery({
        queryKey: ['connection', domain, connectionId],
        queryFn: () => unwrapServiceError(getConnectionInfo(connectionId, domain)),
        refetchInterval: NEXT_PUBLIC_POLLING_INTERVAL_MS,
    });

    const handleSecretsNavigation = useCallback(() => {
        captureEvent('wa_connection_secrets_navigation_pressed', {});
        router.push(`/${domain}/secrets`);
    }, [captureEvent, domain, router]);

    const onRetrySync = useCallback(async () => {
        const result = await flagConnectionForSync(connectionId, domain);
        if (isServiceError(result)) {
            toast({
                description: `❌ Failed to flag connection for sync.`,
            });
            captureEvent('wa_connection_retry_sync_fail', {
                error: result.errorCode,
            });
        } else {
            toast({
                description: "✅ Connection flagged for sync.",
            });
            captureEvent('wa_connection_retry_sync_success', {});
            refetch();
        }
    }, [connectionId, domain, toast, captureEvent, refetch]);
    

    if (error) {
        return <div className="text-destructive">
            {`Error loading connection. Reason: ${error.message}`}
        </div>
    }

    if (isPending) {
        return (
            <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-lg border border-border p-4 bg-background">
                        <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                        <div className="mt-2 h-4 w-24 bg-muted rounded animate-pulse" />
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div className="mt-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-border p-4 bg-background">
                    <h2 className="text-sm font-medium text-muted-foreground">Connection Type</h2>
                    <p className="mt-2 text-sm">{connection.connectionType}</p>
                </div>
                <div className="rounded-lg border border-border p-4 bg-background">
                    <h2 className="text-sm font-medium text-muted-foreground">Last Synced At</h2>
                    <p className="mt-2 text-sm">
                        {connection.syncedAt ? new Date(connection.syncedAt).toLocaleDateString() : "never"}
                    </p>
                </div>
                <div className="rounded-lg border border-border p-4 bg-background">
                    <h2 className="text-sm font-medium text-muted-foreground">Linked Repositories</h2>
                    <p className="mt-2 text-sm">{connection.numLinkedRepos}</p>
                </div>
                <div className="rounded-lg border border-border p-4 bg-background">
                    <h2 className="text-sm font-medium text-muted-foreground">Status</h2>
                    <div className="flex items-center gap-2 mt-2">
                        {connection.syncStatus === "FAILED" ? (
                            <HoverCard openDelay={50}>
                                <HoverCardTrigger onMouseEnter={() => captureEvent('wa_connection_failed_status_hover', {})}>
                                    <SyncStatusBadge status={connection.syncStatus} />
                                </HoverCardTrigger>
                                <HoverCardContent className="w-80">
                                    <DisplayConnectionError
                                        syncStatusMetadata={connection.syncStatusMetadata}
                                        onSecretsClick={handleSecretsNavigation}
                                    />
                                </HoverCardContent>
                            </HoverCard>
                        ) : (
                            <SyncStatusBadge status={connection.syncStatus} />
                        )}
                        {connection.syncStatus === "FAILED" && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="ml-2"
                                onClick={onRetrySync}
                            >
                                <ReloadIcon className="h-4 w-4 mr-2" />
                                Retry Sync
                            </Button>
                        )}
                    </div>
                </div>
            </div>
            <NotFoundWarning
                syncStatus={connection.syncStatus}
                syncStatusMetadata={connection.syncStatusMetadata}
                onSecretsClick={handleSecretsNavigation}
                connectionType={connection.connectionType}
                onRetrySync={onRetrySync}
            />
        </div>
    )
}

const SyncStatusBadge = ({ status }: { status: ConnectionSyncStatus }) => {
    return (
        <Badge
            className="select-none px-2 py-1"
            variant={status === ConnectionSyncStatus.FAILED ? "destructive" : "outline"}
        >
            {status === ConnectionSyncStatus.SYNC_NEEDED || status === ConnectionSyncStatus.IN_SYNC_QUEUE ? (
                <><FiLoader className="w-4 h-4 mr-2 animate-spin-slow" /> Sync queued</>
            ) : status === ConnectionSyncStatus.SYNCING ? (
                <><FiLoader className="w-4 h-4 mr-2 animate-spin-slow" /> Syncing</>
            ) : status === ConnectionSyncStatus.SYNCED ? (
                <span className="flex flex-row items-center text-green-700 dark:text-green-400"><CircleCheckIcon className="w-4 h-4 mr-2" /> Synced</span>
            ) : status === ConnectionSyncStatus.SYNCED_WITH_WARNINGS ? (
                <span className="flex flex-row items-center text-yellow-700 dark:text-yellow-400"><AlertTriangle className="w-4 h-4 mr-2" /> Synced with warnings</span>
            ) : status === ConnectionSyncStatus.FAILED ? (
                <><CircleXIcon className="w-4 h-4 mr-2" /> Sync failed</>
            ) : null}
        </Badge>
    )
}