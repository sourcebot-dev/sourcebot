"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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
import { AlertCircle, ArrowUpDown } from "lucide-react"
import * as React from "react"
import { CopyIconButton } from "../../components/copyIconButton"
import { useMemo } from "react"

// @see: https://v0.app/chat/repo-indexing-status-uhjdDim8OUS

export type RepoIndexingJob = {
    id: string
    type: "INDEX" | "CLEANUP"
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED"
    createdAt: Date
    updatedAt: Date
    completedAt: Date | null
    errorMessage: string | null
}

const statusBadgeVariants = cva("", {
    variants: {
        status: {
            PENDING: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            IN_PROGRESS: "bg-primary text-primary-foreground hover:bg-primary/90",
            COMPLETED: "bg-green-600 text-white hover:bg-green-700",
            FAILED: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        },
    },
})

const getStatusBadge = (status: RepoIndexingJob["status"]) => {
    const labels = {
        PENDING: "Pending",
        IN_PROGRESS: "In Progress",
        COMPLETED: "Completed",
        FAILED: "Failed",
    }

    return <Badge className={statusBadgeVariants({ status })}>{labels[status]}</Badge>
}

const getTypeBadge = (type: RepoIndexingJob["type"]) => {
    return (
        <Badge variant="outline" className="font-mono">
            {type}
        </Badge>
    )
}

const formatDate = (date: Date | null) => {
    if (!date) return "-"
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date)
}

const getDuration = (start: Date, end: Date | null) => {
    if (!end) return "-"
    const diff = end.getTime() - start.getTime()
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    return `${minutes}m ${seconds}s`
}

export const columns: ColumnDef<RepoIndexingJob>[] = [
    {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => getTypeBadge(row.getValue("type")),
        filterFn: (row, id, value) => {
            return value.includes(row.getValue(id))
        },
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const job = row.original
            return (
                <div className="flex items-center gap-2">
                    {getStatusBadge(row.getValue("status"))}
                    {job.errorMessage && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-sm">
                                    <p className="text-sm">{job.errorMessage}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
            )
        },
        filterFn: (row, id, value) => {
            return value.includes(row.getValue(id))
        },
    },
    {
        accessorKey: "createdAt",
        header: ({ column }) => {
            return (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    Started
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => formatDate(row.getValue("createdAt")),
    },
    {
        accessorKey: "completedAt",
        header: ({ column }) => {
            return (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    Completed
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => formatDate(row.getValue("completedAt")),
    },
    {
        id: "duration",
        header: "Duration",
        cell: ({ row }) => {
            const job = row.original
            return getDuration(job.createdAt, job.completedAt)
        },
    },
    {
        accessorKey: "id",
        header: "Job ID",
        cell: ({ row }) => {
            const id = row.getValue("id") as string
            return (
                <div className="flex items-center gap-2">
                    <code className="text-xs text-muted-foreground">{id}</code>
                    <CopyIconButton onCopy={() => {
                        navigator.clipboard.writeText(id);
                        return true;
                    }} />
                </div>
            )
        },
    },
]

export const RepoJobsTable = ({ data }: { data: RepoIndexingJob[] }) => {
    const [sorting, setSorting] = React.useState<SortingState>([{ id: "createdAt", desc: true }])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})

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
        state: {
            sorting,
            columnFilters,
            columnVisibility,
        },
    })

    const {
        numCompleted,
        numInProgress,
        numPending,
        numFailed,
    } = useMemo(() => {
        return {
            numCompleted: data.filter((job) => job.status === "COMPLETED").length,
            numInProgress: data.filter((job) => job.status === "IN_PROGRESS").length,
            numPending: data.filter((job) => job.status === "PENDING").length,
            numFailed: data.filter((job) => job.status === "FAILED").length,
        };
    }, [data]);

    return (
        <div className="w-full">
            <div className="flex items-center gap-4 py-4">
                <Select
                    value={(table.getColumn("status")?.getFilterValue() as string) ?? "all"}
                    onValueChange={(value) => table.getColumn("status")?.setFilterValue(value === "all" ? "" : value)}
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
                    </SelectContent>
                </Select>

                <Select
                    value={(table.getColumn("type")?.getFilterValue() as string) ?? "all"}
                    onValueChange={(value) => table.getColumn("type")?.setFilterValue(value === "all" ? "" : value)}
                >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        <SelectItem value="INDEX">Index</SelectItem>
                        <SelectItem value="CLEANUP">Cleanup</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id}>
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
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    No indexing jobs found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-end space-x-2 py-4">
                <div className="flex-1 text-sm text-muted-foreground">
                    {table.getFilteredRowModel().rows.length} job(s) total
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
