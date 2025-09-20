"use client"

import { Button } from "@/components/ui/button"
import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, Clock, Loader2, CheckCircle2, XCircle, Trash2, Check, ListFilter } from "lucide-react"
import Image from "next/image"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn, getRepoImageSrc } from "@/lib/utils"
import { RepoIndexingStatus } from "@sourcebot/db";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { getBrowsePath } from "../browse/hooks/useBrowseNavigation"

export type RepositoryColumnInfo = {
    repoId: number
    repoName: string;
    repoDisplayName: string
    imageUrl?: string
    repoIndexingStatus: RepoIndexingStatus
    lastIndexed: string
}

const statusLabels = {
    [RepoIndexingStatus.NEW]: "Queued",
    [RepoIndexingStatus.IN_INDEX_QUEUE]: "Queued",
    [RepoIndexingStatus.INDEXING]: "Indexing",
    [RepoIndexingStatus.INDEXED]: "Indexed",
    [RepoIndexingStatus.FAILED]: "Failed",
    [RepoIndexingStatus.IN_GC_QUEUE]: "Deleting",
    [RepoIndexingStatus.GARBAGE_COLLECTING]: "Deleting",
    [RepoIndexingStatus.GARBAGE_COLLECTION_FAILED]: "Deletion Failed"
};

const StatusIndicator = ({ status }: { status: RepoIndexingStatus }) => {
    let icon = null
    let description = ""
    let className = ""

    switch (status) {
        case RepoIndexingStatus.NEW:
        case RepoIndexingStatus.IN_INDEX_QUEUE:
            icon = <Clock className="h-3.5 w-3.5" />
            description = "Repository is queued for indexing"
            className = "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400"
            break
        case RepoIndexingStatus.INDEXING:
            icon = <Loader2 className="h-3.5 w-3.5 animate-spin" />
            description = "Repository is being indexed"
            className = "text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400"
            break
        case RepoIndexingStatus.INDEXED:
            icon = <CheckCircle2 className="h-3.5 w-3.5" />
            description = "Repository has been successfully indexed"
            className = "text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400"
            break
        case RepoIndexingStatus.FAILED:
            icon = <XCircle className="h-3.5 w-3.5" />
            description = "Repository indexing failed"
            className = "text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400"
            break
        case RepoIndexingStatus.IN_GC_QUEUE:
        case RepoIndexingStatus.GARBAGE_COLLECTING:
            icon = <Trash2 className="h-3.5 w-3.5" />
            description = "Repository is being deleted"
            className = "text-gray-600 bg-gray-50 dark:bg-gray-900/20 dark:text-gray-400"
            break
        case RepoIndexingStatus.GARBAGE_COLLECTION_FAILED:
            icon = <XCircle className="h-3.5 w-3.5" />
            description = "Repository deletion failed"
            className = "text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400"
            break
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div
                        className={cn("flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full w-fit", className)}
                    >
                        {icon}
                        {statusLabels[status]}
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p className="text-sm">{description}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

export const columns = (domain: string): ColumnDef<RepositoryColumnInfo>[] => [
    {
        accessorKey: "repoDisplayName",
        header: 'Repository',
        cell: ({ row: { original: { repoId, repoName, repoDisplayName, imageUrl } } }) => {
            return (
                <div className="flex flex-row items-center gap-3 py-2">
                    <div className="relative h-8 w-8 overflow-hidden rounded-md border bg-muted">
                        {imageUrl ? (
                            <Image
                                src={getRepoImageSrc(imageUrl, repoId, domain) || "/placeholder.svg"}
                                alt={`${repoDisplayName} logo`}
                                width={32}
                                height={32}
                                className="object-cover"
                            />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center bg-muted text-xs font-medium uppercase text-muted-foreground">
                                {repoDisplayName.charAt(0)}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            className={"font-medium text-primary hover:underline cursor-pointer"}
                            href={getBrowsePath({
                                repoName: repoName,
                                path: '/',
                                pathType: 'tree',
                                domain
                            })}
                        >
                            {repoDisplayName.length > 40 ? `${repoDisplayName.slice(0, 40)}...` : repoDisplayName}
                        </Link>
                    </div>
                </div>
            )
        },
    },
    {
        accessorKey: "repoIndexingStatus",
        header: ({ column }) => {
            const uniqueLabels = Array.from(new Set(Object.values(statusLabels)));
            const currentFilter = column.getFilterValue() as string | undefined;

            return (
                <div className="w-[150px]">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button 
                                variant="ghost"
                                className={cn(
                                    "px-0 font-medium hover:bg-transparent focus:bg-transparent active:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0",
                                    currentFilter ? "text-primary hover:text-primary" : "text-muted-foreground hover:text-muted-foreground"
                                )}
                            >
                                Status
                                <ListFilter className={cn(
                                    "ml-2 h-3.5 w-3.5",
                                    currentFilter ? "text-primary" : "text-muted-foreground"
                                )} />
                                {currentFilter && (
                                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => column.setFilterValue(undefined)}>
                                <Check className={cn("mr-2 h-4 w-4", !column.getFilterValue() ? "opacity-100" : "opacity-0")} />
                                All
                            </DropdownMenuItem>
                            {uniqueLabels.map((label) => (
                                <DropdownMenuItem key={label} onClick={() => column.setFilterValue(label)}>
                                    <Check className={cn("mr-2 h-4 w-4", column.getFilterValue() === label ? "opacity-100" : "opacity-0")} />
                                    {label}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )
        },
        cell: ({ row }) => {
            return <StatusIndicator status={row.original.repoIndexingStatus} />
        },
        filterFn: (row, id, value) => {
            if (value === undefined) return true;
            
            const status = row.getValue(id) as RepoIndexingStatus;
            return statusLabels[status] === value;
        },
    },
    {
        accessorKey: "lastIndexed",
        header: ({ column }) => (
            <div className="w-[150px]">
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="px-0 font-medium hover:bg-transparent focus:bg-transparent active:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                >
                    Last Indexed
                    <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                </Button>
            </div>
        ),
        cell: ({ row }) => {
            if (!row.original.lastIndexed) {
                return <div>-</div>;
            }
            const date = new Date(row.original.lastIndexed)
            return (
                <div>
                    <div className="font-medium">
                        {date.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                        })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {date
                            .toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                            })
                            .toLowerCase()}
                    </div>
                </div>
            )
        },
    },
]
