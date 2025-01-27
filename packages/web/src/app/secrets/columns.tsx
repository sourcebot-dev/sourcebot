'use client';

import { Button } from "@/components/ui/button";
import { Column, ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"

export type SecretColumnInfo = {
    key: string;
    createdAt: string;
}

export const columns = (handleDelete: (key: string) => void): ColumnDef<SecretColumnInfo>[] => {
    return [
        {
            accessorKey: "key",
            cell: ({ row }) => {
                const secret = row.original;
                return <div>{secret.key}</div>;
            }
        },
        {
            accessorKey: "createdAt",
            header: ({ column }) => createSortHeader("Created At", column),
            cell: ({ row }) => {
                const secret = row.original;
                return <div>{secret.createdAt}</div>;
            }
        },
        {
            accessorKey: "delete",
            cell: ({ row }) => {
                const secret = row.original;
                return (
                    <Button
                        variant="destructive"
                        onClick={() => {
                            handleDelete(secret.key);
                        }}
                    >
                        Delete
                    </Button>
                )
            }
        }
    ]

}

const createSortHeader = (name: string, column: Column<SecretColumnInfo, unknown>) => {
    return (
        <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
            {name}
            <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
    )
}