'use client';

import { AlertTriangle, Info, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAuthProviderInfo, unwrapServiceError } from "@/lib/utils";
import { getPermissionSyncStatus } from "@/app/api/(client)/client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { usePrevious } from "@uidotdev/usehooks";
import { BannerShell } from "./bannerShell";
import type { BannerProps } from "./types";
import type { PermissionSyncStatusResponse } from "@/app/api/(server)/ee/permissionSyncStatus/api";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const POLL_INTERVAL_MS = 5000;
const ISSUE_POLL_INTERVAL_MS = 30000;

interface PermissionSyncBannerProps extends BannerProps {
    initialStatus: PermissionSyncStatusResponse;
}

export function PermissionSyncBanner({ id, dismissible, initialStatus }: PermissionSyncBannerProps) {
    const router = useRouter();

    const { data: status, isError, isPending } = useQuery({
        queryKey: ["permissionSyncStatus"],
        queryFn: () => unwrapServiceError(getPermissionSyncStatus()),
        refetchInterval: (query) => {
            if (query.state.data?.hasPendingFirstSync) {
                return POLL_INTERVAL_MS;
            }
            return query.state.data?.issues.length ? ISSUE_POLL_INTERVAL_MS : false;
        },
        initialData: initialStatus,
    });

    const previousHasPendingFirstSync = usePrevious(status.hasPendingFirstSync);
    const previousIssueCount = usePrevious(status.issues.length);

    useEffect(() => {
        const initialSyncCompleted =
            previousHasPendingFirstSync === true && status.hasPendingFirstSync === false;
        const issueResolved = previousIssueCount !== undefined &&
            previousIssueCount > 0 && status.issues.length === 0;
        if (initialSyncCompleted || issueResolved) {
            router.refresh();
        }
    }, [status.hasPendingFirstSync, status.issues.length, previousHasPendingFirstSync, previousIssueCount, router]);

    if (isError || isPending) {
        return null;
    }

    const issue = status.issues[0];
    if (issue) {
        const providerName = status.issues.length === 1
            ? getAuthProviderInfo(issue.providerType).displayName
            : `${status.issues.length} code hosts`;
        const requiresAdditionalScope = status.issues.some(({ reason }) => reason === 'INSUFFICIENT_SCOPE');
        const description = status.issues.length > 1
            ? "Sourcebot could not verify permissions for multiple linked accounts. Private repository access has been disabled until you review and reauthorize the affected accounts."
            : requiresAdditionalScope
                ? "Sourcebot could not verify your repository permissions because the required OAuth scope was not granted. Private repository access has been disabled until you reauthorize the affected account."
                : "Sourcebot could not verify your repository permissions. Private repository access has been disabled until you reconnect the affected account.";

        return (
            <BannerShell
                id={id}
                dismissible={dismissible}
                icon={<AlertTriangle className="h-4 w-4 mt-0.5" />}
                title={`Repository access from ${providerName} needs attention.`}
                description={description}
                action={(
                    <Button asChild variant="outline" size="sm">
                        <Link href="/settings/linked-accounts">Review linked accounts</Link>
                    </Button>
                )}
            />
        );
    }

    if (!status.hasPendingFirstSync) {
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
