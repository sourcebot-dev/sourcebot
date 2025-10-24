"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants"
import { CodeHostType, getCodeHostCommitUrl, getCodeHostInfoForRepo, getRepoImageSrc } from "@/lib/utils"
import {
    type ColumnDef,
    type ColumnFiltersState,
    type SortingState,
    type VisibilityState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table"
import { cva } from "class-variance-authority"
import { ArrowUpDown, ExternalLink, MoreHorizontal, RefreshCwIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useMemo, useState } from "react"
import { getBrowsePath } from "../../browse/hooks/utils"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/hooks/use-toast";
import { DisplayDate } from "../../components/DisplayDate"

// @see: https://v0.app/chat/repo-indexing-status-uhjdDim8OUS

export type Repo = {
    id: number
    name: string
    displayName: string | null
    isArchived: boolean
    isPublic: boolean
    indexedAt: Date | null
    createdAt: Date
    webUrl: string | null
    codeHostType: string
    imageUrl: string | null
    indexedCommitHash: string | null
    latestJobStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | null
}

const statusBadgeVariants = cva("", {
    variants: {
        status: {
            PENDING: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            IN_PROGRESS: "bg-primary text-primary-foreground hover:bg-primary/90",
            COMPLETED: "bg-green-600 text-white hover:bg-green-700",
            FAILED: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            NO_JOBS: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        },
    },
})

const getStatusBadge = (status: Repo["latestJobStatus"]) => {
    if (!status) {
        return <Badge className={statusBadgeVariants({ status: "NO_JOBS" })}>No Jobs</Badge>
    }

    const labels = {
        PENDING: "Pending",
        IN_PROGRESS: "In Progress",
        COMPLETED: "Completed",
        FAILED: "Failed",
    }

    return <Badge className={statusBadgeVariants({ status })}>{labels[status]}</Badge>
}

export const columns: ColumnDef<Repo>[] = [
    {
        accessorKey: "displayName",
        size: 400,
        header: ({ column }) => {
            return (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    Repository
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => {
            const repo = row.original
            return (
                <div className="flex flex-row gap-2 items-center">
                    {repo.imageUrl ? (
                        <Image
                            src={getRepoImageSrc(repo.imageUrl, repo.id) || "/placeholder.svg"}
                            alt={`${repo.displayName} logo`}
                            width={32}
                            height={32}
                            className="object-cover"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted text-xs font-medium uppercase text-muted-foreground">
                            {repo.displayName?.charAt(0) ?? repo.name.charAt(0)}
                        </div>
                    )}
                    <Link href={getBrowsePath({
                        repoName: repo.name,
                        path: '/',
                        pathType: 'tree',
                        domain: SINGLE_TENANT_ORG_DOMAIN,
                    })} className="font-medium hover:underline">
                        {repo.displayName || repo.name}
                    </Link>
                </div>
            )
        },
    },
    {
        accessorKey: "latestJobStatus",
        size: 150,
        header: "Lastest status",
        cell: ({ row }) => getStatusBadge(row.getValue("latestJobStatus")),
    },
    {
        accessorKey: "indexedAt",
        size: 200,
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Last synced
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => {
            const indexedAt = row.getValue("indexedAt") as Date | null;
            if (!indexedAt) {
                return "-";
            }

            return (
                <DisplayDate date={indexedAt} className="ml-3"/>
            )
        }
    },
    {
        accessorKey: "indexedCommitHash",
        size: 120,
        header: "Last commit",
        cell: ({ row }) => {
            const hash = row.getValue("indexedCommitHash") as string | null;
            if (!hash) {
                return "-";
            }

            const smallHash = hash.slice(0, 7);
            const repo = row.original;
            const codeHostType = repo.codeHostType as CodeHostType;
            const webUrl = repo.webUrl;

            const commitUrl = getCodeHostCommitUrl({
                webUrl,
                codeHostType,
                commitHash: hash,
            });

            if (!commitUrl) {
                return <span className="font-mono text-sm">{smallHash}</span>
            }

            return <Link
                href={commitUrl}
                className="font-mono text-sm text-link hover:underline"
            >
                {smallHash}
            </Link>
        },
    },
    {
        id: "actions",
        size: 80,
        enableHiding: false,
        cell: ({ row }) => {
            const repo = row.original
            const codeHostInfo = getCodeHostInfoForRepo({
                codeHostType: repo.codeHostType,
                name: repo.name,
                displayName: repo.displayName ?? undefined,
                webUrl: repo.webUrl ?? undefined,
            });

            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                            <Link href={`/${SINGLE_TENANT_ORG_DOMAIN}/repos/${repo.id}`}>View details</Link>
                        </DropdownMenuItem>
                        {(repo.webUrl && codeHostInfo) && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <a href={repo.webUrl} target="_blank" rel="noopener noreferrer" className="flex items-center">
                                        Open in {codeHostInfo.codeHostName}
                                        <ExternalLink className="ml-2 h-3 w-3" />
                                    </a>
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        },
    },
]

export const ReposTable = ({ data }: { data: Repo[] }) => {
    const [sorting, setSorting] = useState<SortingState>([])
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
    const [rowSelection, setRowSelection] = useState({})
    const router = useRouter();
    const { toast } = useToast();

    const {
        numCompleted,
        numInProgress,
        numPending,
        numFailed,
        numNoJobs,
    } = useMemo(() => {
        return {
            numCompleted: data.filter((repo) => repo.latestJobStatus === "COMPLETED").length,
            numInProgress: data.filter((repo) => repo.latestJobStatus === "IN_PROGRESS").length,
            numPending: data.filter((repo) => repo.latestJobStatus === "PENDING").length,
            numFailed: data.filter((repo) => repo.latestJobStatus === "FAILED").length,
            numNoJobs: data.filter((repo) => repo.latestJobStatus === null).length,
        }
    }, [data]);

    const table = useReactTable({
        data,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        columnResizeMode: 'onChange',
        enableColumnResizing: false,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
        },
    })

    return (
        <div className="w-full">
            <div className="flex items-center gap-4 py-4">
                <Input
                    placeholder="Filter repositories..."
                    value={(table.getColumn("displayName")?.getFilterValue() as string) ?? ""}
                    onChange={(event) => table.getColumn("displayName")?.setFilterValue(event.target.value)}
                    className="max-w-sm"
                />
                <Select
                    value={(table.getColumn("latestJobStatus")?.getFilterValue() as string) ?? "all"}
                    onValueChange={(value) => {
                        table.getColumn("latestJobStatus")?.setFilterValue(value === "all" ? "" : value)
                    }}
                >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Filter by status</SelectItem>
                        <SelectItem value="COMPLETED">Completed ({numCompleted})</SelectItem>
                        <SelectItem value="IN_PROGRESS">In progress ({numInProgress})</SelectItem>
                        <SelectItem value="PENDING">Pending ({numPending})</SelectItem>
                        <SelectItem value="FAILED">Failed ({numFailed})</SelectItem>
                        <SelectItem value="null">No status ({numNoJobs})</SelectItem>
                    </SelectContent>
                </Select>
                <Button
                    variant="outline"
                    className="ml-auto"
                    onClick={() => {
                        router.refresh();
                        toast({
                            description: "Page refreshed",
                        });
                    }}
                >
                    <RefreshCwIcon className="w-3 h-3" />
                    Refresh
                </Button>
            </div>
            <div className="rounded-md border">
                <Table style={{ tableLayout: 'fixed', width: '100%' }}>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead 
                                            key={header.id}
                                            style={{ width: `${header.getSize()}px` }}
                                        >
                                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell 
                                            key={cell.id}
                                            style={{ width: `${cell.column.getSize()}px` }}
                                        >
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-end space-x-2 py-4">
                <div className="flex-1 text-sm text-muted-foreground">
                    {table.getFilteredRowModel().rows.length} {data.length > 1 ? 'repositories' : 'repository'} total
                </div>
                <div className="space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        Previous
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                        Next
                    </Button>
                </div>
            </div>
        </div>
    )
}
