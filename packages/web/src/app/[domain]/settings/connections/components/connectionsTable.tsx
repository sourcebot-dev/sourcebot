"use client"

import { DisplayDate } from "@/app/[domain]/components/DisplayDate"
import { NotificationDot } from "@/app/[domain]/components/notificationDot"
import { useToast } from "@/components/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants"
import { CodeHostType, getCodeHostIcon } from "@/lib/utils"
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
import { ArrowUpDown, RefreshCwIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"


export type Connection = {
    id: number
    name: string
    syncedAt: Date | null
    codeHostType: CodeHostType
    latestJobStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | null
    isFirstTimeSync: boolean
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

const getStatusBadge = (status: Connection["latestJobStatus"]) => {
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

export const columns: ColumnDef<Connection>[] = [
    {
        accessorKey: "name",
        size: 400,
        header: ({ column }) => {
            return (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => {
            const connection = row.original;
            const codeHostIcon = getCodeHostIcon(connection.codeHostType);

            return (
                <div className="flex flex-row gap-2 items-center">
                    <Image
                        src={codeHostIcon.src}
                        alt={`${connection.codeHostType} logo`}
                        width={20}
                        height={20}
                    />
                    <Link href={`/${SINGLE_TENANT_ORG_DOMAIN}/settings/connections/${connection.id}`} className="font-medium hover:underline">
                        {connection.name}
                    </Link>
                    {connection.isFirstTimeSync && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span>
                                    <NotificationDot className="ml-1.5" />
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>
                                <span>This is the first time Sourcebot is syncing this connection. It may take a few minutes to complete.</span>
                            </TooltipContent>
                        </Tooltip>
                    )}
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
        accessorKey: "syncedAt",
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
            const syncedAt = row.getValue("syncedAt") as Date | null;
            if (!syncedAt) {
                return "-";
            }

            return (
                <DisplayDate date={syncedAt} className="ml-3" />
            )
        }
    },
]

export const ConnectionsTable = ({ data }: { data: Connection[] }) => {
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
            numCompleted: data.filter((connection) => connection.latestJobStatus === "COMPLETED").length,
            numInProgress: data.filter((connection) => connection.latestJobStatus === "IN_PROGRESS").length,
            numPending: data.filter((connection) => connection.latestJobStatus === "PENDING").length,
            numFailed: data.filter((connection) => connection.latestJobStatus === "FAILED").length,
            numNoJobs: data.filter((connection) => connection.latestJobStatus === null).length,
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
                    placeholder="Filter connections..."
                    value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
                    onChange={(event) => table.getColumn("name")?.setFilterValue(event.target.value)}
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
                <Table style={{ width: '100%' }}>
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
                    {table.getFilteredRowModel().rows.length} {data.length > 1 ? 'connections' : 'connection'} total
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
