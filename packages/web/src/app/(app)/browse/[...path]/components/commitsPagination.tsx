import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommitsPaginationProps {
    page: number;
    perPage: number;
    totalCount: number;
    extraParams?: Record<string, string | undefined>;
}

const buildHref = (page: number, extraParams?: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    if (extraParams) {
        for (const [key, value] of Object.entries(extraParams)) {
            if (value !== undefined && value !== '') {
                params.set(key, value);
            }
        }
    }
    return `?${params.toString()}`;
};

export const CommitsPagination = ({ page, perPage, totalCount, extraParams }: CommitsPaginationProps) => {
    const hasPrev = page > 1;
    const hasNext = page * perPage < totalCount;

    if (!hasPrev && !hasNext) {
        return null;
    }

    const linkClass = "flex flex-row items-center gap-1 text-sm text-primary hover:underline";
    const disabledClass = "flex flex-row items-center gap-1 text-sm text-muted-foreground cursor-not-allowed";

    return (
        <div className="flex flex-row items-center justify-center gap-6 py-6">
            {hasPrev ? (
                <Link href={buildHref(page - 1, extraParams)} className={linkClass}>
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                </Link>
            ) : (
                <span className={cn(disabledClass)} aria-disabled="true">
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                </span>
            )}
            {hasNext ? (
                <Link href={buildHref(page + 1, extraParams)} className={linkClass}>
                    Next
                    <ChevronRight className="h-4 w-4" />
                </Link>
            ) : (
                <span className={cn(disabledClass)} aria-disabled="true">
                    Next
                    <ChevronRight className="h-4 w-4" />
                </span>
            )}
        </div>
    );
};
