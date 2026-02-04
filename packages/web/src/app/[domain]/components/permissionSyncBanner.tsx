'use client';

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { unwrapServiceError } from "@/lib/utils";
import { getPermissionSyncStatus } from "@/app/api/(client)/client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { usePrevious } from "@uidotdev/usehooks";

const POLL_INTERVAL_MS = 5000;

export function PermissionSyncBanner() {
    const router = useRouter();

    const { data: hasPendingFirstSync, isError, isPending } = useQuery({
        queryKey: ["permissionSyncStatus"],
        queryFn: () => unwrapServiceError(getPermissionSyncStatus()),
        select: (data) => {
            return data.hasPendingFirstSync;
        },
        refetchInterval: (query) => {
            const hasPendingFirstSync = query.state.data?.hasPendingFirstSync;
            // Keep polling while sync is in progress, stop when done
            return hasPendingFirstSync ? POLL_INTERVAL_MS : false;
        },
    });

    const previousHasPendingFirstSync = usePrevious(hasPendingFirstSync);

    // Refresh the page when sync completes
    useEffect(() => {
        if (previousHasPendingFirstSync === true && hasPendingFirstSync === false) {
            router.refresh();
        }
    }, [hasPendingFirstSync, previousHasPendingFirstSync, router]);

    // Don't show anything if we can't get status or no pending first sync
    if (isError || isPending) {
        return null;
    }

    if (!hasPendingFirstSync) {
        return null;
    }

    return (
        <Alert className="rounded-none border-x-0 border-t-0 bg-accent">
            <Info className="h-4 w-4 mt-0.5" />
            <AlertTitle className="flex items-center gap-2">
                Syncing repository access with Sourcebot.
                <Loader2 className="h-4 w-4 animate-spin" />
            </AlertTitle>
            <AlertDescription>
                Sourcebot is syncing what repositories you have access to from a code host. This may take a minute.
            </AlertDescription>
        </Alert>
    );
}
