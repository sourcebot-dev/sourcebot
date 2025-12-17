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
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants"
import { cn, getCodeHostCommitUrl, getCodeHostIcon, getCodeHostInfoForRepo, getRepoImageSrc } from "@/lib/utils"
import {
    type ColumnDef,
    type SortingState,
    type VisibilityState,
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table"
import { cva } from "class-variance-authority"
import { ArrowUpDown, ExternalLink, Loader2, MoreHorizontal, RefreshCwIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { getBrowsePath } from "../../browse/hooks/utils"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useToast } from "@/components/hooks/use-toast";
import { DisplayDate } from "../../components/DisplayDate"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { NotificationDot } from "../../components/notificationDot"
import { CodeHostType } from "@sourcebot/db"
import { useHotkeys } from "react-hotkeys-hook"

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
    codeHostType: CodeHostType
    imageUrl: string | null
    indexedCommitHash: string | null
    latestJobStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | null
    isFirstTimeIndex: boolean
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

const getStatusBadge = (status: Repo["latestJobStatus"]) => {
    if (!status) {
        return "-";
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
            const repo = row.original;
            const codeHostIcon = getCodeHostIcon(repo.codeHostType);
            const repoImageSrc = repo.imageUrl ? getRepoImageSrc(repo.imageUrl, repo.id) : undefined;

            return (
                <div className="flex flex-row gap-2 items-center">
                    {
                        repoImageSrc ? (
                            <Image
                                src={repoImageSrc}
                                alt={`${repo.displayName} logo`}
                                width={32}
                                height={32}
                                className="object-cover"
                            />
                        ) : <Image
                            src={codeHostIcon.src}
                            alt={`${repo.displayName} logo`}
                            width={32}
                            height={32}
                            className={cn(codeHostIcon.className)}
                        />
                    }

                    {/* Link to the details page (instead of browse) when the repo is indexing
                        as the code will not be available yet */}
                    <Link
                        href={repo.isFirstTimeIndex ? `/${SINGLE_TENANT_ORG_DOMAIN}/repos/${repo.id}` : getBrowsePath({
                            repoName: repo.name,
                            path: '/',
                            pathType: 'tree',
                            domain: SINGLE_TENANT_ORG_DOMAIN,
                        })}
                        className="font-medium hover:underline"
                    >
                        <span>{repo.displayName || repo.name}</span>
                    </Link>
                    {repo.isFirstTimeIndex && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span>
                                    <NotificationDot className="ml-1.5" />
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>
                                <span>This is the first time Sourcebot is indexing this repository. It may take a few minutes to complete.</span>
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
                <DisplayDate date={indexedAt} className="ml-3" />
            )
        }
    },
    {
        accessorKey: "indexedCommitHash",
        size: 150,
        header: "Synced commit",
        cell: ({ row }) => {
            const hash = row.getValue("indexedCommitHash") as string | null;
            if (!hash) {
                return "-";
            }

            const smallHash = hash.slice(0, 7);
            const repo = row.original;
            const codeHostType = repo.codeHostType;
            const webUrl = repo.webUrl;

            const commitUrl = getCodeHostCommitUrl({
                webUrl,
                codeHostType,
                commitHash: hash,
            });

            const HashComponent = commitUrl ? (
                <Link
                    href={commitUrl}
                    className="font-mono text-sm text-link hover:underline"
                >
                    {smallHash}
                </Link>
            ) : (
                <span className="font-mono text-sm text-muted-foreground">
                    {smallHash}
                </span>
            )

            return (
                <Tooltip>
                    <TooltipTrigger asChild>
                        {HashComponent}
                    </TooltipTrigger>
                    <TooltipContent>
                        <span className="font-mono">{hash}</span>
                    </TooltipContent>
                </Tooltip>
            );
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
                        {repo.webUrl && (
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

interface ReposTableProps {
    data: Repo[];
    currentPage: number;
    pageSize: number;
    totalCount: number;
    initialSearch: string;
    initialStatus: string;
}

export const ReposTable = ({ 
    data, 
    currentPage, 
    pageSize, 
    totalCount, 
    initialSearch, 
    initialStatus,
}: ReposTableProps) => {
    const [sorting, setSorting] = useState<SortingState>([])
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
    const [rowSelection, setRowSelection] = useState({})
    const [searchValue, setSearchValue] = useState(initialSearch)
    const [isPendingSearch, setIsPendingSearch] = useState(false)
    const searchInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const { toast } = useToast();

    // Focus search box when '/' is pressed
    useHotkeys('/', (event) => {
        event.preventDefault();
        searchInputRef.current?.focus();
    });

    // Debounced search effect - only runs when searchValue changes
    useEffect(() => {
        setIsPendingSearch(true);
        const timer = setTimeout(() => {
            const params = new URLSearchParams(searchParams.toString());
            if (searchValue) {
                params.set('search', searchValue);
            } else {
                params.delete('search');
            }
            params.set('page', '1'); // Reset to page 1 on search
            router.replace(`${pathname}?${params.toString()}`);
            setIsPendingSearch(false);
        }, 300);
        
        return () => {
            clearTimeout(timer);
            setIsPendingSearch(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchValue]);

    const updateStatusFilter = (value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === 'all') {
            params.delete('status');
        } else {
            params.set('status', value);
        }
        params.set('page', '1'); // Reset to page 1 on filter change
        router.replace(`${pathname}?${params.toString()}`);
    };

    const totalPages = Math.ceil(totalCount / pageSize);

    const table = useReactTable({
        data,
        columns,
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        columnResizeMode: 'onChange',
        enableColumnResizing: false,
        state: {
            sorting,
            columnVisibility,
            rowSelection,
        },
    })

    return (
        <div className="w-full">
            <div className="flex items-center gap-4 py-4">
                <InputGroup className="max-w-sm">
                    <InputGroupInput
                        ref={searchInputRef}
                        placeholder="Filter repositories..."
                        value={searchValue}
                        onChange={(event) => setSearchValue(event.target.value)}
                        className="ring-0"
                    />
                    {isPendingSearch && (
                        <InputGroupAddon align="inline-end">
                            <Loader2 className="h-4 w-4 animate-spin" />
                        </InputGroupAddon>
                    )}
                </InputGroup>
                <Select
                    value={initialStatus}
                    onValueChange={updateStatusFilter}
                >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Filter by status</SelectItem>
                        <SelectItem value="COMPLETED">Completed</SelectItem>
                        <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="FAILED">Failed</SelectItem>
                        <SelectItem value="null">No status</SelectItem>
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
                    {totalCount} {totalCount !== 1 ? 'repositories' : 'repository'} total
                    {totalPages > 1 && ` • Page ${currentPage} of ${totalPages}`}
                </div>
                <div className="space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            const params = new URLSearchParams(searchParams.toString());
                            params.set('page', String(currentPage - 1));
                            router.push(`${pathname}?${params.toString()}`);
                        }}
                        disabled={currentPage <= 1}
                    >
                        Previous
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                            const params = new URLSearchParams(searchParams.toString());
                            params.set('page', String(currentPage + 1));
                            router.push(`${pathname}?${params.toString()}`);
                        }}
                        disabled={currentPage >= totalPages}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    )
}
