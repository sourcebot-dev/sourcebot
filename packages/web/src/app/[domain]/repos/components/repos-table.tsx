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
import { getRepoImageSrc } from "@/lib/utils"
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
import { ArrowUpDown, ExternalLink, MoreHorizontal } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import * as React from "react"

export type Repo = {
    id: number
    name: string
    displayName: string | null
    isArchived: boolean
    isPublic: boolean
    indexedAt: Date | null
    createdAt: Date
    webUrl: string | null
    imageUrl: string | null
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

const formatDate = (date: Date | null) => {
    if (!date) return "Never"
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date)
}

export const columns: ColumnDef<Repo>[] = [
    {
        accessorKey: "displayName",
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
                    <Link href={`/repos/${repo.id}`} className="font-medium hover:underline">
                        {repo.displayName || repo.name}
                    </Link>
                </div>
            )
        },
    },
    {
        accessorKey: "latestJobStatus",
        header: "Status",
        cell: ({ row }) => getStatusBadge(row.getValue("latestJobStatus")),
    },
    {
        accessorKey: "indexedAt",
        header: ({ column }) => {
            return (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    Last Indexed
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => formatDate(row.getValue("indexedAt")),
    },
    {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => {
            const repo = row.original

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
                        {repo.webUrl && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <a href={repo.webUrl} target="_blank" rel="noopener noreferrer" className="flex items-center">
                                        Open in GitHub
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
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
    const [rowSelection, setRowSelection] = React.useState({})

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
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="COMPLETED">Completed</SelectItem>
                        <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="FAILED">Failed</SelectItem>
                        <SelectItem value="null">No Jobs</SelectItem>
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
                                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
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
