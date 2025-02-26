'use client';

import useCaptureEvent from "@/hooks/useCaptureEvent";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { DisplayConnectionError } from "./connectionError"
import { RetrySyncButton } from "./retrySyncButton"
import { NotFoundWarning } from "./notFoundWarning"
import { useDomain } from "@/hooks/useDomain";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getConnectionInfo } from "@/actions";

interface OverviewProps {
    connectionId: number;
}

export const Overview = ({ connectionId }: OverviewProps) => {
    const captureEvent = useCaptureEvent();
    const domain = useDomain();
    const router = useRouter();

    const handleSecretsNavigation = useCallback(() => {
        captureEvent('wa_connection_secrets_navigation_pressed', {});
        router.push(`/${domain}/secrets`);
    }, [captureEvent, domain, router]);

    const { data: connection } = useQuery({
        queryKey: ['connection', domain, connectionId],
        queryFn: async () => {
            const connection = await getConnectionInfo(connectionId, domain);
            return connection;
        }
    })

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
                    <p className="mt-2 text-sm">{numLinkedRepos}</p>
                </div>
                <div className="rounded-lg border border-border p-4 bg-background">
                    <h2 className="text-sm font-medium text-muted-foreground">Status</h2>
                    <div className="flex items-center gap-2 mt-2">
                        {connection.syncStatus === "FAILED" ? (
                            <HoverCard openDelay={50}>
                                <HoverCardTrigger asChild onMouseEnter={() => captureEvent('wa_connection_failed_status_hover', {})}>
                                    <div className="flex items-center">
                                        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-400 ring-1 ring-inset ring-red-600/20 cursor-help hover:text-red-600 hover:bg-red-100 transition-colors duration-200">
                                            {connection.syncStatus}
                                        </span>
                                    </div>
                                </HoverCardTrigger>
                                <HoverCardContent className="w-80">
                                    <DisplayConnectionError
                                        syncStatusMetadata={connection.syncStatusMetadata}
                                        onSecretsClick={handleSecretsNavigation}
                                    />
                                </HoverCardContent>
                            </HoverCard>
                        ) : (
                            <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                                {connection.syncStatus}
                            </span>
                        )}
                        {connection.syncStatus === "FAILED" && (
                            <RetrySyncButton connectionId={connection.id} domain={domain} />
                        )}
                    </div>
                </div>
            </div>
            <NotFoundWarning syncStatusMetadata={connection.syncStatusMetadata} onSecretsClick={handleSecretsNavigation} connectionId={connection.id} connectionType={connection.connectionType} domain={domain} />
        </div>
    )

}