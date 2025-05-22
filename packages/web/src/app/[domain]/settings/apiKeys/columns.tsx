"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, Key } from "lucide-react"
import { Button } from "@/components/ui/button"

export type ApiKeyColumnInfo = {
    name: string
    createdAt: string
    lastUsedAt: string | null
}

export const columns = (): ColumnDef<ApiKeyColumnInfo>[] => [
    {
        accessorKey: "name",
        header: () => <div className="flex items-center w-[300px]">Name</div>,
        cell: ({ row }) => {
            const name = row.original.name
            return (
                <div className="flex items-center gap-2 py-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{name}</span>
                </div>
            )
        },
    },
    {
        accessorKey: "createdAt",
        header: ({ column }) => (
            <div className="w-[200px]">
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="px-0 font-medium"
                >
                    Created
                    <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
                </Button>
            </div>
        ),
        cell: ({ row }) => {
            if (!row.original.createdAt) {
                return <div className="py-2">—</div>
            }
            const date = new Date(row.original.createdAt)
            return (
                <div className="py-2 text-muted-foreground">
                    {date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                    })}
                </div>
            )
        },
    },
    {
        accessorKey: "lastUsedAt",
        header: ({ column }) => (
            <div className="w-[200px]">
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="px-0 font-medium"
                >
                    Last Used
                    <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
                </Button>
            </div>
        ),
        cell: ({ row }) => {
            if (!row.original.lastUsedAt) {
                return <div className="py-2 text-muted-foreground">Never</div>
            }
            const date = new Date(row.original.lastUsedAt)
            return (
                <div className="py-2 text-muted-foreground">
                    {date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                    })}
                </div>
            )
        },
    },
] 