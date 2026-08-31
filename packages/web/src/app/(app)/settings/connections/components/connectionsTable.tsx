"use client";

import { DisplayDate } from "@/app/(app)/components/DisplayDate";
import { Button } from "@/components/ui/button";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@/components/ui/input-group";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn, getCodeHostIcon } from "@/lib/utils";
import type { ConnectionType } from "@sourcebot/db";
import type { WorkloadJob } from "@sourcebot/shared";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@uidotdev/usehooks";
import {
    type ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, CircleX, Loader2, Search } from "lucide-react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useTransition,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";
import type { ConnectionSyncStatusesResponse } from "../types";
import { ConnectionActionsMenu } from "./connectionActionsMenu";
import {
    getConnectionSyncAnnotation,
    SyncAnnotation,
} from "./syncAnnotation";

const POLL_INTERVAL_MS = 5_000;

export type Connection = {
    id: number;
    name: string;
    connectionType: ConnectionType;
    syncedAt: Date | null;
    latestJob: WorkloadJob<"connection-sync"> | null;
};

type DisplayedConnection = Connection & {
    showCompleted: boolean;
};

type SortBy = "name" | "syncedAt";
type SortOrder = "asc" | "desc";
type StatusFilter = "all" | "failed" | "warning";

const getStatusFilter = (value: string | null): StatusFilter => {
    if (value === "failed" || value === "warning") {
        return value;
    }

    return "all";
};

const getConnectionSyncStatuses = async (
    connectionIds: number[],
    signal: AbortSignal,
): Promise<ConnectionSyncStatusesResponse> => {
    const response = await fetch("/api/connection-sync-status", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ connectionIds }),
        signal,
    });

    if (!response.ok) {
        throw new Error("Failed to load connection sync statuses");
    }

    return response.json() as Promise<ConnectionSyncStatusesResponse>;
};

const SortableHeader = ({
    label,
    column,
    sortBy,
    sortOrder,
    onSortChange,
}: {
    label: string;
    column: SortBy;
    sortBy: SortBy;
    sortOrder: SortOrder;
    onSortChange: (column: SortBy) => void;
}) => {
    const isActive = sortBy === column;
    const SortIcon = isActive && sortOrder === "desc" ? ArrowUp : ArrowDown;

    return (
        <Button
            variant="ghost"
            className="group -ml-3 h-8 gap-0 px-3 [&_svg]:size-3"
            size="sm"
            onClick={() => onSortChange(column)}
            aria-label={`Sort by ${label}`}
        >
            {label}
            <SortIcon
                className={cn(
                    "ml-1 transition-opacity",
                    isActive
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100",
                )}
            />
        </Button>
    );
};

const getColumns = ({
    sortBy,
    sortOrder,
    onSortChange,
    onSyncScheduled,
}: {
    sortBy: SortBy;
    sortOrder: SortOrder;
    onSortChange: (column: SortBy) => void;
    onSyncScheduled: (connectionId: number, jobId: string) => void;
}): ColumnDef<DisplayedConnection>[] => [
    {
        accessorKey: "name",
        header: () => (
            <SortableHeader
                label="Name"
                column="name"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
            />
        ),
        cell: ({ row }) => {
            const connection = row.original;
            const codeHostIcon = getCodeHostIcon(connection.connectionType);

            return (
                <div className="flex min-w-0 items-center gap-2">
                    <Image
                        src={codeHostIcon.src}
                        alt={`${connection.connectionType} logo`}
                        width={24}
                        height={24}
                        className={cn(
                            "shrink-0 rounded-md",
                            codeHostIcon.className,
                        )}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">
                        {connection.name}
                    </span>
                    <SyncAnnotation
                        connectionId={connection.id}
                        connectionName={connection.name}
                        syncedAt={connection.syncedAt}
                        latestJob={connection.latestJob}
                        showCompleted={connection.showCompleted}
                        onRetryScheduled={onSyncScheduled}
                    />
                </div>
            );
        },
    },
    {
        accessorKey: "syncedAt",
        header: () => (
            <SortableHeader
                label="Last synced"
                column="syncedAt"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
            />
        ),
        cell: ({ row }) => row.original.syncedAt
            ? <DisplayDate date={row.original.syncedAt} />
            : "-",
    },
    {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
            <div className="flex justify-end">
                <ConnectionActionsMenu
                    connection={row.original}
                    isSyncing={getConnectionSyncAnnotation(
                        row.original.id,
                        row.original.latestJob,
                        row.original.syncedAt,
                    ) === "SYNCING"}
                    onSyncScheduled={onSyncScheduled}
                />
            </div>
        ),
    },
];

type ConnectionsTableProps = {
    data: Connection[];
    currentPage: number;
    pageSize: number;
    totalCount: number;
    sortBy: SortBy;
    sortOrder: SortOrder;
};

export const ConnectionsTable = ({
    data,
    currentPage,
    pageSize,
    totalCount,
    sortBy,
    sortOrder,
}: ConnectionsTableProps) => {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const searchParamsString = searchParams.toString();
    const urlSearchValue = searchParams.get("search") ?? "";
    const statusFilter = getStatusFilter(searchParams.get("status"));
    const [searchValue, setSearchValue] = useState(urlSearchValue);
    const [scheduledSyncJobs, setScheduledSyncJobs] = useState<
        Map<number, WorkloadJob<"connection-sync">>
    >(() => new Map());
    const debouncedSearchValue = useDebounce(searchValue, 300);
    const [isSearchNavigationPending, startSearchTransition] = useTransition();
    const pendingSearchValuesRef = useRef<Set<string>>(new Set());
    const searchInputRef = useRef<HTMLInputElement>(null);
    const isSearchPending = searchValue !== debouncedSearchValue
        || isSearchNavigationPending;

    useHotkeys("/", (event) => {
        event.preventDefault();
        searchInputRef.current?.focus();
    });

    useEffect(() => {
        if (pendingSearchValuesRef.current.delete(urlSearchValue)) {
            return;
        }

        setSearchValue(urlSearchValue);
    }, [urlSearchValue]);

    useEffect(() => {
        if (debouncedSearchValue !== searchValue) {
            return;
        }

        const nextSearchValue = debouncedSearchValue.trim();
        if (nextSearchValue === urlSearchValue) {
            return;
        }

        const params = new URLSearchParams(searchParamsString);
        if (nextSearchValue) {
            params.set("search", nextSearchValue);
        } else {
            params.delete("search");
        }
        params.delete("page");

        const nextSearchParamsString = params.toString();
        if (nextSearchParamsString === searchParamsString) {
            return;
        }

        pendingSearchValuesRef.current.add(nextSearchValue);
        startSearchTransition(() => {
            router.replace(
                `${pathname}${nextSearchParamsString ? `?${nextSearchParamsString}` : ""}`,
                { scroll: false },
            );
        });
    }, [
        debouncedSearchValue,
        pathname,
        router,
        searchParamsString,
        searchValue,
        urlSearchValue,
    ]);

    const onSyncScheduled = useCallback((
        connectionId: number,
        jobId: string,
    ) => {
        setScheduledSyncJobs((currentJobs) => {
            const nextJobs = new Map(currentJobs);
            nextJobs.set(connectionId, {
                id: jobId,
                data: { connectionId },
                status: "PENDING",
                startedAt: null,
                errorMessage: null,
                result: null,
            });
            return nextJobs;
        });
    }, []);
    const syncAwareData = useMemo(
        () => data.map((connection) => {
            const scheduledJob = scheduledSyncJobs.get(connection.id);
            return scheduledJob
                ? { ...connection, latestJob: scheduledJob }
                : connection;
        }),
        [data, scheduledSyncJobs],
    );
    const pollingTargets = useMemo(
        () => syncAwareData.flatMap((connection) => {
            const latestJob = connection.latestJob;
            if (
                !latestJob
                || getConnectionSyncAnnotation(
                        connection.id,
                        latestJob,
                        connection.syncedAt,
                    ) !== "SYNCING"
            ) {
                return [];
            }

            return [{ connectionId: connection.id, jobId: latestJob.id }];
        }),
        [syncAwareData],
    );
    const pollingConnectionIds = useMemo(
        () => pollingTargets.map(({ connectionId }) => connectionId),
        [pollingTargets],
    );
    const pollingKey = useMemo(
        () => pollingTargets.map(({ connectionId, jobId }) =>
            `${connectionId}:${jobId}`
        ),
        [pollingTargets],
    );
    const { data: polledStatuses } = useQuery({
        queryKey: [
            "connections-sync-status",
            pollingConnectionIds,
            pollingKey,
        ],
        queryFn: ({ signal }) =>
            getConnectionSyncStatuses(pollingConnectionIds, signal),
        enabled: pollingConnectionIds.length > 0,
        placeholderData: (previousData) => previousData,
        refetchInterval: (query) => {
            const statuses = query.state.data?.connections;
            if (!statuses) {
                return POLL_INTERVAL_MS;
            }

            return pollingTargets.some((target) => {
                const status = statuses.find(
                    ({ connectionId }) =>
                        connectionId === target.connectionId,
                );
                if (!status || status.latestJob?.id !== target.jobId) {
                    return true;
                }

                return status.latestJob.status === "PENDING"
                    || status.latestJob.status === "IN_PROGRESS";
            })
                ? POLL_INTERVAL_MS
                : false;
        },
    });
    const completedDuringPollingConnectionIds = useMemo(() => {
        const pollingTargetsByConnectionId = new Map(
            pollingTargets.map((target) => [target.connectionId, target]),
        );
        return new Set(
            polledStatuses?.connections.flatMap((status) => {
                const target = pollingTargetsByConnectionId.get(
                    status.connectionId,
                );
                return target
                    && status.latestJob?.id === target.jobId
                    && status.latestJob.status === "COMPLETED"
                    && status.syncedAt
                    ? [status.connectionId]
                    : [];
            }) ?? [],
        );
    }, [polledStatuses, pollingTargets]);
    const displayedData = useMemo(() => {
        const statusesByConnectionId = new Map(
            polledStatuses?.connections.map((status) => [
                status.connectionId,
                status,
            ]) ?? [],
        );

        return syncAwareData.map((connection): DisplayedConnection => {
            const showCompleted = completedDuringPollingConnectionIds.has(
                connection.id,
            );
            const status = statusesByConnectionId.get(connection.id);
            const scheduledJob = scheduledSyncJobs.get(connection.id);
            if (!status) {
                return { ...connection, showCompleted };
            }
            if (scheduledJob && status.latestJob?.id !== scheduledJob.id) {
                return {
                    ...connection,
                    syncedAt: status.syncedAt
                        ? new Date(status.syncedAt)
                        : connection.syncedAt,
                    showCompleted,
                };
            }

            return {
                ...connection,
                syncedAt: status.syncedAt
                    ? new Date(status.syncedAt)
                    : connection.syncedAt,
                latestJob: status.latestJob,
                showCompleted,
            };
        });
    }, [
        completedDuringPollingConnectionIds,
        polledStatuses,
        scheduledSyncJobs,
        syncAwareData,
    ]);

    const onSortChange = useCallback((column: SortBy) => {
        const params = new URLSearchParams(searchParams.toString());
        const nextSortOrder = sortBy === column && sortOrder === "asc"
            ? "desc"
            : "asc";
        params.delete("page");
        if (column === "name") {
            params.delete("sortBy");
        } else {
            params.set("sortBy", column);
        }
        if (nextSortOrder === "asc") {
            params.delete("sortOrder");
        } else {
            params.set("sortOrder", nextSortOrder);
        }

        const query = params.toString();
        router.push(query ? `${pathname}?${query}` : pathname);
    }, [pathname, router, searchParams, sortBy, sortOrder]);
    const columns = useMemo(
        () => getColumns({
            sortBy,
            sortOrder,
            onSortChange,
            onSyncScheduled,
        }),
        [onSortChange, onSyncScheduled, sortBy, sortOrder],
    );
    const table = useReactTable({
        data: displayedData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        manualSorting: true,
        rowCount: totalCount,
        state: {
            pagination: {
                pageIndex: currentPage - 1,
                pageSize,
            },
            sorting: [{ id: sortBy, desc: sortOrder === "desc" }],
        },
    });
    const totalPages = Math.max(1, table.getPageCount());
    const firstVisibleConnection = totalCount === 0
        ? 0
        : (currentPage - 1) * pageSize + 1;
    const lastVisibleConnection = Math.min(currentPage * pageSize, totalCount);
    const hasActiveFilters = statusFilter !== "all"
        || urlSearchValue.trim().length > 0;

    const goToPage = (page: number) => {
        const params = new URLSearchParams(searchParams.toString());
        if (page === 1) {
            params.delete("page");
        } else {
            params.set("page", page.toString());
        }
        const query = params.toString();
        router.push(query ? `${pathname}?${query}` : pathname);
    };

    const onStatusFilterChange = (status: StatusFilter) => {
        const params = new URLSearchParams(searchParams.toString());
        if (status === "all") {
            params.delete("status");
        } else {
            params.set("status", status);
        }
        params.delete("page");

        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, {
            scroll: false,
        });
    };

    const clearFilters = () => {
        const params = new URLSearchParams(searchParamsString);
        params.delete("search");
        params.delete("status");
        params.delete("page");

        const nextSearchParamsString = params.toString();
        setSearchValue("");
        pendingSearchValuesRef.current.add("");
        startSearchTransition(() => {
            router.replace(
                `${pathname}${nextSearchParamsString ? `?${nextSearchParamsString}` : ""}`,
                { scroll: false },
            );
        });
    };

    const emptyMessage = statusFilter === "failed"
        ? "No failed connections."
        : statusFilter === "warning"
            ? "No connections with warnings."
            : "No connections found.";

    return (
        <div>
            <div className="mb-3 flex items-center gap-2">
                <InputGroup className="h-9 max-w-sm">
                    <InputGroupAddon>
                        <Search className="h-4 w-4" />
                    </InputGroupAddon>
                    <InputGroupInput
                        ref={searchInputRef}
                        value={searchValue}
                        onChange={(event) => setSearchValue(event.target.value)}
                        placeholder="Search connections..."
                    />
                    {isSearchPending && (
                        <InputGroupAddon align="inline-end">
                            <Loader2
                                className="h-4 w-4 animate-spin"
                                aria-label="Searching connections"
                            />
                        </InputGroupAddon>
                    )}
                </InputGroup>
                <Select
                    value={statusFilter}
                    onValueChange={(value) =>
                        onStatusFilterChange(value as StatusFilter)}
                >
                    <SelectTrigger
                        className="h-9 w-40"
                        aria-label="Filter connections by status"
                    >
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Filter by status</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                    </SelectContent>
                </Select>
                {hasActiveFilters && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9"
                        onClick={clearFilters}
                    >
                        <CircleX className="h-4 w-4" />
                        Clear filters
                    </Button>
                )}
            </div>
            <div className="rounded-md border">
                <Table className="table-fixed">
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead
                                        key={header.id}
                                        className={cn(
                                            "h-10",
                                            header.column.id === "syncedAt" && "w-44",
                                            header.column.id === "actions" && "w-12",
                                        )}
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                  header.column.columnDef.header,
                                                  header.getContext(),
                                              )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.length > 0 ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id} className="h-12">
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell
                                            key={cell.id}
                                            className={cn(
                                                "px-4 py-2",
                                                cell.column.id === "syncedAt"
                                                    && "w-44 whitespace-nowrap",
                                                cell.column.id === "actions"
                                                    && "w-12 px-2",
                                            )}
                                        >
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-28 text-center text-sm text-muted-foreground"
                                >
                                    <p>{emptyMessage}</p>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            {totalCount > 0 && (
                <div className="flex items-center justify-between py-4">
                    <p className="text-sm text-muted-foreground">
                        Showing {firstVisibleConnection}-{lastVisibleConnection} of {totalCount}
                    </p>
                    <div className="flex items-center gap-4">
                        <p className="text-sm text-muted-foreground">
                            Page {currentPage} of {totalPages}
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => goToPage(currentPage - 1)}
                                disabled={!table.getCanPreviousPage()}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => goToPage(currentPage + 1)}
                                disabled={!table.getCanNextPage()}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
