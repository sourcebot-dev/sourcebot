import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { BannerShell } from "./bannerShell";
import type { BannerProps } from "./types";

interface RepositoryFirstSyncBannerProps extends BannerProps {
    syncingCount: number;
}

export function RepositoryFirstSyncBanner({
    id,
    dismissible,
    syncingCount,
}: RepositoryFirstSyncBannerProps) {
    const isSingular = syncingCount === 1;

    return (
        <BannerShell
            id={id}
            dismissible={dismissible}
            icon={<Loader2 className="mt-0.5 h-4 w-4 animate-spin" />}
            title={`${syncingCount} ${isSingular ? "repository is" : "repositories are"} syncing for the first time`}
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
