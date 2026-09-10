"use client";

import { getRepositorySyncCounts } from "@/app/api/(client)/client";
import { Button } from "@/components/ui/button";
import type { RepositorySyncCounts } from "@/features/repos/repositorySyncCounts.server";
import { unwrapServiceError } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { usePrevious } from "@uidotdev/usehooks";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { BannerShell } from "./bannerShell";
import type { BannerProps } from "./types";

const POLL_INTERVAL_MS = 5_000;

interface RepositoryFirstSyncBannerProps extends BannerProps {
    initialCounts: RepositorySyncCounts;
}

export function RepositoryFirstSyncBanner({
    id,
    dismissible,
    initialCounts,
}: RepositoryFirstSyncBannerProps) {
    const router = useRouter();
    const { data: counts, isError, isPending } = useQuery({
        queryKey: ["repository-sync-counts"],
        queryFn: () => unwrapServiceError(getRepositorySyncCounts()),
        refetchInterval: (query) =>
            query.state.data?.firstTimeSyncingCount
                ? POLL_INTERVAL_MS
                : false,
        initialData: initialCounts,
    });
    const previousCount = usePrevious(counts.firstTimeSyncingCount);

    useEffect(() => {
        if (
            previousCount !== undefined
            && previousCount > 0
            && counts.firstTimeSyncingCount === 0
        ) {
            router.refresh();
        }
    }, [counts.firstTimeSyncingCount, previousCount, router]);

    if (isError || isPending || counts.firstTimeSyncingCount === 0) {
        return null;
    }

    const firstTimeSyncingCount = counts.firstTimeSyncingCount;
    const isSingular = firstTimeSyncingCount === 1;

    return (
        <BannerShell
            id={id}
            dismissible={dismissible}
            icon={<Loader2 className="mt-0.5 h-4 w-4 animate-spin" />}
            title={`${firstTimeSyncingCount} ${isSingular ? "repository is" : "repositories are"} syncing for the first time`}
            description={`${isSingular ? "It" : "They"} won't be available until syncing completes.`}
            action={(
                <Button asChild size="sm" variant="outline">
                    <Link href="/repos?sortBy=indexedAt&sortOrder=desc">
                        View repositories
                    </Link>
                </Button>
            )}
        />
    );
}
