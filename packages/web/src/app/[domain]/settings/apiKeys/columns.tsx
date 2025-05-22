"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, Key, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { deleteApiKey } from "@/actions"
import { useParams } from "next/navigation"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useState } from "react"

export type ApiKeyColumnInfo = {
    name: string
    createdAt: string
    lastUsedAt: string | null
}

// Component for the actions cell to properly use React hooks
function ApiKeyActions({ apiKey }: { apiKey: ApiKeyColumnInfo }) {
    const params = useParams<{ domain: string }>()
    const [isPending, setIsPending] = useState(false)
    
    const handleDelete = async () => {
        setIsPending(true)
        try {
            await deleteApiKey(apiKey.name, params.domain)
            window.location.reload()
        } catch (error) {
            console.error("Failed to delete API key", error)
        } finally {
            setIsPending(false)
        }
    }
    
    return (
        <div className="flex justify-end">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete API Key</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete the API key <span className="font-semibold text-foreground">{apiKey.name}</span>? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleDelete} 
                            disabled={isPending}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isPending ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
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
    {
        id: "actions",
        cell: ({ row }) => <ApiKeyActions apiKey={row.original} />
    }
] 