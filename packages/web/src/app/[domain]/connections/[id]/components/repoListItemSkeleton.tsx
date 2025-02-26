import { Skeleton } from "@/components/ui/skeleton"

export const RepoListItemSkeleton = () => {
    return (
        <div className="flex flex-row items-center p-4 border rounded-lg bg-background justify-between">
            <div className="flex flex-row items-center gap-2">
                <Skeleton className="h-10 w-10 rounded-full animate-pulse" />
                <Skeleton className="h-4 w-32 animate-pulse" />
            </div>
            <div className="flex flex-row items-center gap-2">
                <Skeleton className="h-4 w-24 animate-pulse" />
            </div>
        </div>
    )
}