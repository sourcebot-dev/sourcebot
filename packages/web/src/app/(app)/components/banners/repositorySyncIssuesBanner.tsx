import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { BannerShell } from "./bannerShell";
import type { BannerProps } from "./types";

interface RepositorySyncIssuesBannerProps extends BannerProps {
    failedCount: number;
    warningCount: number;
}

const pluralizeRepository = (count: number) =>
    count === 1 ? "repository" : "repositories";

export function RepositorySyncIssuesBanner({
    id,
    dismissible,
    failedCount,
    warningCount,
}: RepositorySyncIssuesBannerProps) {
    const totalCount = failedCount + warningCount;
    const descriptions = [
        failedCount > 0
            ? `${failedCount} ${pluralizeRepository(failedCount)} failed to sync and ${failedCount === 1 ? "is" : "are"} unavailable.`
            : null,
        warningCount > 0
            ? `${warningCount} ${pluralizeRepository(warningCount)} ${warningCount === 1 ? "has a warning" : "have warnings"} and may contain stale results.`
            : null,
    ].filter((description): description is string => description !== null);

    return (
        <BannerShell
            id={id}
            dismissible={dismissible}
            icon={(
                <AlertTriangle
                    className={cn(
                        "h-4 w-4 mt-0.5",
                        failedCount > 0 && "text-destructive",
                    )}
                />
            )}
            title={`${totalCount} ${pluralizeRepository(totalCount)} ${totalCount === 1 ? "needs" : "need"} attention`}
            description={descriptions.join(" ")}
            action={(
                <>
                    {failedCount > 0 && (
                        <Button asChild size="sm" variant="outline">
                            <Link href="/repos?status=failed">View failed</Link>
                        </Button>
                    )}
                    {warningCount > 0 && (
                        <Button asChild size="sm" variant="outline">
                            <Link href="/repos?status=warning">View warnings</Link>
                        </Button>
                    )}
                </>
            )}
        />
    );
}
