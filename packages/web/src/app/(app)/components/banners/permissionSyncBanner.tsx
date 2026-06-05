'use client';

import { Loader2, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { unwrapServiceError } from "@/lib/utils";
import { getPermissionSyncStatus } from "@/app/api/(client)/client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { usePrevious } from "@uidotdev/usehooks";
import { BannerShell } from "./bannerShell";
import type { BannerProps } from "./types";

const POLL_INTERVAL_MS = 5000;

interface PermissionSyncBannerProps extends BannerProps {
    initialHasPendingFirstSync: boolean;
}

export function PermissionSyncBanner({ id, dismissible, initialHasPendingFirstSync }: PermissionSyncBannerProps) {
    const router = useRouter();

    const { data: hasPendingFirstSync, isError, isPending } = useQuery({
        queryKey: ["permissionSyncStatus"],
        queryFn: () => unwrapServiceError(getPermissionSyncStatus()),
        select: (data) => {
            return data.hasPendingFirstSync;
        },
        refetchInterval: (query) => {
            const hasPendingFirstSync = query.state.data?.hasPendingFirstSync;
            return hasPendingFirstSync ? POLL_INTERVAL_MS : false;
        },
        initialData: {
            hasPendingFirstSync: initialHasPendingFirstSync,
        }
    });

    const previousHasPendingFirstSync = usePrevious(hasPendingFirstSync);

    useEffect(() => {
        if (previousHasPendingFirstSync === true && hasPendingFirstSync === false) {
            router.refresh();
        }
    }, [hasPendingFirstSync, previousHasPendingFirstSync, router]);

    if (isError || isPending) {
        return null;
    }

    if (!hasPendingFirstSync) {
        return null;
    }

    return (
        <BannerShell
            id={id}
            dismissible={dismissible}
            icon={<Info className="h-4 w-4 mt-0.5" />}
            title={
                <span className="flex items-center gap-2">
                    Syncing repository access with Sourcebot.
                    <Loader2 className="h-4 w-4 animate-spin" />
                </span>
            }
            description="Sourcebot is syncing what repositories you have access to from a code host. This may take a minute."
        />
    );
}
