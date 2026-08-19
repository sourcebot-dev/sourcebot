import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { BannerShell } from "./bannerShell";
import type { BannerProps } from "./types";

interface ConnectionSyncIssuesBannerProps extends BannerProps {
    count: number;
    status: "failed" | "warning";
}

const pluralizeConnection = (count: number) =>
    count === 1 ? "connection" : "connections";

export function ConnectionSyncIssuesBanner({
    id,
    dismissible,
    count,
    status,
}: ConnectionSyncIssuesBannerProps) {
    const isFailed = status === "failed";
    const isSingular = count === 1;

    return (
        <BannerShell
            id={id}
            dismissible={dismissible}
            icon={(
                <AlertTriangle
                    className={cn(
                        "mt-0.5 h-4 w-4",
                        isFailed && "text-destructive",
                    )}
                />
            )}
            title={`${count} code host ${pluralizeConnection(count)} ${isSingular ? "needs" : "need"} attention`}
            description={isFailed
                ? `${isSingular ? "This connection" : "These connections"} failed to sync. Repositories are unavailable.`
                : `${isSingular ? "This connection has a warning" : "These connections have warnings"}. Repository discovery may be incomplete or out of date.`}
            action={(
                <Button asChild size="sm" variant="outline">
                    <Link href={`/settings/connections?status=${status}`}>
                        {isFailed ? "View failed" : "View warnings"}
                    </Link>
                </Button>
            )}
        />
    );
}
