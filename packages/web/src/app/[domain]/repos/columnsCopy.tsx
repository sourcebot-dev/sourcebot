"use client"

import { Button } from "@/components/ui/button"
import type { Column, ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, ExternalLink, GitBranch } from "lucide-react"
import prettyBytes from "pretty-bytes"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"

export type RepositoryColumnInfo = {
    name: string
    imageUrl: string // Repository image URL
    branches: {
        name: string
        version: string
    }[]
    connections: {
        id: string
        name: string
    }[] // Array of connections with IDs
    repoSizeBytes: number
    indexedFiles: number
    indexSizeBytes: number
    shardCount: number
    lastIndexed: string
    latestCommit: string
    commitUrlTemplate: string
    url: string
}

export const columns: ColumnDef<RepositoryColumnInfo>[] = [
    {
        accessorKey: "name",
        header: "Repository",
        cell: ({ row }) => {
            const repo = row.original
            const url = repo.url
            const isRemoteRepo = url.length > 0

            return (
                <div className="flex flex-row items-center gap-3 py-2">
                    <div className="relative h-8 w-8 overflow-hidden rounded-md border bg-muted">
                        {repo.imageUrl ? (
                            <Image
                                src={repo.imageUrl || "/placeholder.svg"}
                                alt={`${repo.name} logo`}
                                width={32}
                                height={32}
                                className="object-cover"
                            />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center bg-muted text-xs font-medium uppercase text-muted-foreground">
                                {repo.name.charAt(0)}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span
                            className={isRemoteRepo ? "font-medium text-primary hover:underline cursor-pointer" : "font-medium"}
                            onClick={() => {
                                if (isRemoteRepo) {
                                    window.open(url, "_blank")
                                }
                            }}
                        >
                            {repo.name}
                        </span>
                        {isRemoteRepo && <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                </div>
            )
        },
    },
    {
        accessorKey: "connections",
        header: "Connections",
        cell: ({ row }) => {
            const connections = row.original.connections

            if (!connections || connections.length === 0) {
                return <div className="text-muted-foreground text-sm">—</div>
            }

            return (
                <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                    {connections.map((connection, i) => (
                        <Badge
                            key={i}
                            variant="outline"
                            className="text-xs px-2 py-0.5 hover:bg-muted cursor-pointer"
                            onClick={() => {
                                window.location.href = `/connections/${connection.id}`
                            }}
                        >
                            {connection.name}
                        </Badge>
                    ))}
                </div>
            )
        },
    },
    {
        accessorKey: "branches",
        header: "Branches",
        cell: ({ row }) => {
            const branches = row.original.branches

            if (branches.length === 0) {
                return <div className="text-muted-foreground text-sm">—</div>
            }

            return (
                <div className="max-h-32 overflow-auto pr-2">
                    {branches.map(({ name, version }, index) => {
                        const shortVersion = version.substring(0, 7)
                        return (
                            <div key={index} className="flex items-center gap-2 py-1 text-sm">
                                <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="font-medium">{name}</span>
                                <span className="text-muted-foreground">@</span>
                                <span
                                    className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded cursor-pointer hover:bg-muted/80"
                                    onClick={() => {
                                        const url = row.original.commitUrlTemplate.replace("{{.Version}}", version)
                                        window.open(url, "_blank")
                                    }}
                                >
                                    {shortVersion}
                                </span>
                            </div>
                        )
                    })}
                </div>
            )
        },
    },
    {
        accessorKey: "shardCount",
        header: ({ column }) => createSortHeader("Shards", column),
        cell: ({ row }) => <div className="text-right font-medium">{row.original.shardCount}</div>,
    },
    {
        accessorKey: "indexedFiles",
        header: ({ column }) => createSortHeader("Files", column),
        cell: ({ row }) => <div className="text-right font-medium">{row.original.indexedFiles.toLocaleString()}</div>,
    },
    {
        accessorKey: "indexSizeBytes",
        header: ({ column }) => createSortHeader("Index Size", column),
        cell: ({ row }) => {
            const size = prettyBytes(row.original.indexSizeBytes)
            return <div className="text-right font-medium">{size}</div>
        },
    },
    {
        accessorKey: "repoSizeBytes",
        header: ({ column }) => createSortHeader("Repo Size", column),
        cell: ({ row }) => {
            const size = prettyBytes(row.original.repoSizeBytes)
            return <div className="text-right font-medium">{size}</div>
        },
    },
    {
        accessorKey: "lastIndexed",
        header: ({ column }) => createSortHeader("Last Indexed", column),
        cell: ({ row }) => {
            const date = new Date(row.original.lastIndexed)
            return (
                <div className="text-right">
                    <div className="font-medium">{formatDate(date)}</div>
                    <div className="text-xs text-muted-foreground">{formatTime(date)}</div>
                </div>
            )
        },
    },
    {
        accessorKey: "latestCommit",
        header: ({ column }) => createSortHeader("Latest Commit", column),
        cell: ({ row }) => {
            const date = new Date(row.original.latestCommit)
            return (
                <div className="text-right">
                    <div className="font-medium">{formatDate(date)}</div>
                    <div className="text-xs text-muted-foreground">{formatTime(date)}</div>
                </div>
            )
        },
    },
]

const createSortHeader = (name: string, column: Column<RepositoryColumnInfo, unknown>) => {
    return (
        <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="font-medium"
        >
            {name}
            <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
        </Button>
    )
}

// Format date as "Feb 27, 2024"
const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    })
}

// Format time as "14:30:45"
const formatTime = (date: Date): string => {
    return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    })
}
