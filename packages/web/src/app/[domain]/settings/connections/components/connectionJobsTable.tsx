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
import { AlertCircle, AlertTriangle, ArrowUpDown, RefreshCwIcon } from "lucide-react"
import * as React from "react"
import { CopyIconButton } from "@/app/[domain]/components/copyIconButton"
import { useMemo } from "react"
import { LightweightCodeHighlighter } from "@/app/[domain]/components/lightweightCodeHighlighter"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/hooks/use-toast"
import { DisplayDate } from "@/app/[domain]/components/DisplayDate"


export type ConnectionSyncJob = {
    id: string
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED"
    createdAt: Date
    updatedAt: Date
    completedAt: Date | null
    errorMessage: string | null
    warningMessages: string[]
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

const getStatusBadge = (status: ConnectionSyncJob["status"]) => {
    const labels = {
        PENDING: "Pending",
        IN_PROGRESS: "In Progress",
        COMPLETED: "Completed",
        FAILED: "Failed",
    }

    return <Badge className={statusBadgeVariants({ status })}>{labels[status]}</Badge>
}

const getDuration = (start: Date, end: Date | null) => {
    if (!end) return "-"
    const diff = end.getTime() - start.getTime()
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    return `${minutes}m ${seconds}s`
}

export const columns: ColumnDef<ConnectionSyncJob>[] = [
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const job = row.original
            return (
                <div className="flex items-center gap-2">
                    {getStatusBadge(row.getValue("status"))}
                    {job.errorMessage ? (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[750px] max-h-96 overflow-scroll p-4">
                                    <LightweightCodeHighlighter
                                        language="text"
                                        lineNumbers={true}
                                        renderWhitespace={false}
                                    >
                                        {job.errorMessage}
                                    </LightweightCodeHighlighter>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ) : job.warningMessages.length > 0 ? (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <AlertTriangle className="h-4 w-4 text-warning" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[750px] max-h-96 overflow-scroll p-4">
                                    <p className="text-sm font-medium mb-2">{job.warningMessages.length} warning(s) while syncing:</p>
                                    <div className="flex flex-col gap-1">
                                        {job.warningMessages.map((warning, index) => (
                                            <div
                                                key={index}
                                                className="text-sm font-mono flex flex-row items-center gap-1.5"
                                            >
                                                <span>{index + 1}.</span>
                                                <span className="text-warning">{warning}</span>
                                            </div>
                                        ))}
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ) : null}
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
        cell: ({ row }) => <DisplayDate date={row.getValue("createdAt") as Date} className="ml-3" />,
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
        cell: ({ row }) => {
            const completedAt = row.getValue("completedAt") as Date | null;
            if (!completedAt) {
                return "-";
            }

            return <DisplayDate date={completedAt} className="ml-3" />
        },
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

export const ConnectionJobsTable = ({ data }: { data: ConnectionSyncJob[] }) => {
    const [sorting, setSorting] = React.useState<SortingState>([{ id: "createdAt", desc: true }])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
    const router = useRouter();
    const { toast } = useToast();

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
                                    No sync jobs found.
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
