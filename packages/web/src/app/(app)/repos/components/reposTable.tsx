"use client";

import { Badge } from "@/components/ui/badge";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, getCodeHostIcon, getRepoImageSrc } from "@/lib/utils";
import type { CodeHostType } from "@sourcebot/db";
import type { WorkloadJob } from "@sourcebot/shared";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@uidotdev/usehooks";
import {
    type ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Check, Loader2, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
import { DisplayDate } from "../../components/DisplayDate";
import { getBrowsePath } from "../../browse/hooks/utils";
import type { RepoIndexingStatusesResponse } from "../types";
import { RepoActionsMenu } from "./repoActionsMenu";
import { SyncIssuePopover } from "./syncIssuePopover";

const POLL_INTERVAL_MS = 5_000;
const COMPLETED_BADGE_VISIBLE_MS = 5_000;

export type Repo = {
    id: number;
    name: string;
    displayName: string | null;
    indexedAt: Date | null;
    indexedCommitHash: string | null;
    latestJob: WorkloadJob<"repo-index"> | null;
    imageUrl: string | null;
    webUrl: string | null;
    codeHostType: CodeHostType;
};

type DisplayedRepo = Repo & {
    showCompleted: boolean;
    showExplicitSyncing: boolean;
};

type SortOrder = "asc" | "desc";
type SortBy = "name" | "indexedAt";
type StatusFilter = "all" | "failed" | "warning";
type SyncAnnotation = "SYNCING" | "WARNING" | "FAILED" | null;

const getStatusFilter = (value: string | null): StatusFilter => {
    if (value === "failed" || value === "warning") {
        return value;
    }

    return "all";
};

const getRepoName = (repo: Repo) => repo.displayName ?? repo.name;

const getRepoIndexingStatuses = async (
    repoIds: number[],
    signal: AbortSignal,
): Promise<RepoIndexingStatusesResponse> => {
    const response = await fetch("/api/repo-index-status", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ repoIds }),
        signal,
    });

    if (!response.ok) {
        throw new Error("Failed to load repository indexing statuses");
    }

    return response.json() as Promise<RepoIndexingStatusesResponse>;
};

const getSyncAnnotation = (repo: Repo): SyncAnnotation => {
    const latestJob = repo.latestJob;
    const isLatestIndexJob = latestJob?.data.repoId === repo.id
        && latestJob.data.type === "INDEX";

    if (isLatestIndexJob && latestJob.status === "FAILED") {
        return repo.indexedAt ? "WARNING" : "FAILED";
    }

    if (
        !repo.indexedAt
        && (
            !isLatestIndexJob
            || latestJob.status === "PENDING"
            || latestJob.status === "IN_PROGRESS"
        )
    ) {
        return "SYNCING";
    }

    return null;
};

const SyncAnnotationBadge = ({
    repo,
    canRetry,
    onRetryScheduled,
    showCompleted,
    showExplicitSyncing,
}: {
    repo: Repo;
    canRetry: boolean;
    onRetryScheduled: (repoId: number, jobId: string) => void;
    showCompleted: boolean;
    showExplicitSyncing: boolean;
}) => {
    const prefersReducedMotion = useReducedMotion();
    const completionKey = showCompleted
        ? repo.latestJob?.id ?? repo.indexedAt?.toISOString() ?? `repo:${repo.id}`
        : null;
    const [expiredCompletionKey, setExpiredCompletionKey] = useState<
        string | null
    >(null);
    useEffect(() => {
        if (!completionKey || expiredCompletionKey === completionKey) {
            return;
        }

        const timeout = window.setTimeout(() => {
            setExpiredCompletionKey(completionKey);
        }, COMPLETED_BADGE_VISIBLE_MS);
        return () => window.clearTimeout(timeout);
    }, [completionKey, expiredCompletionKey]);
    const annotation = completionKey !== null
        && expiredCompletionKey !== completionKey
        ? "COMPLETED"
        : showExplicitSyncing
            ? "SYNCING"
            : getSyncAnnotation(repo);
    const badge = (() => {
        switch (annotation) {
            case "COMPLETED":
                return (
                    <Badge className="shrink-0 gap-1 rounded-sm bg-green-600 text-white hover:bg-green-700">
                        <Check className="h-3 w-3" />
                        Completed
                    </Badge>
                );
            case "SYNCING":
                return (
                    <Badge variant="secondary" className="shrink-0 gap-1 rounded-sm">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Syncing
                    </Badge>
                );
            case "WARNING":
                return (
                    <SyncIssuePopover
                        repo={repo}
                        annotation="WARNING"
                        canRetry={canRetry}
                        onRetryScheduled={onRetryScheduled}
                    />
                );
            case "FAILED":
                return (
                    <SyncIssuePopover
                        repo={repo}
                        annotation="FAILED"
                        canRetry={canRetry}
                        onRetryScheduled={onRetryScheduled}
                    />
                );
            default:
                return null;
        }
    })();

    const isCompleted = annotation === "COMPLETED";

    return (
        <AnimatePresence initial={false} mode="wait">
            {annotation && badge && (
                <motion.div
                    key={annotation}
                    initial={prefersReducedMotion
                        ? false
                        : isCompleted
                            ? {
                                  opacity: 1,
                                  clipPath: "inset(0 0 0 100%)",
                              }
                            : { opacity: 0 }}
                    animate={{
                        opacity: 1,
                        clipPath: "inset(0 0 0 0%)",
                    }}
                    exit={{
                        opacity: 0,
                        transition: {
                            duration: prefersReducedMotion ? 0 : 0.15,
                        },
                    }}
                    transition={{
                        duration: prefersReducedMotion ? 0 : 0.35,
                        ease: [0.22, 1, 0.36, 1],
                    }}
                    className="shrink-0"
                >
                    {badge}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

const SortableHeader = ({
    label,
    column,
    sortBy,
    sortOrder,
    onSortChange,
    tooltip,
}: {
    label: string;
    column: SortBy;
    sortBy: SortBy;
    sortOrder: SortOrder;
    onSortChange: (column: SortBy) => void;
    tooltip?: string;
}) => {
    const isActive = sortBy === column;
    const SortIcon = isActive && sortOrder === "desc" ? ArrowUp : ArrowDown;

    const button = (
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

    if (!tooltip) {
        return button;
    }

    return (
        <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent>
                <p>{tooltip}</p>
            </TooltipContent>
        </Tooltip>
    );
};

const getColumns = ({
    sortBy,
    sortOrder,
    onSortChange,
    canRetry,
    onRetryScheduled,
}: {
    sortBy: SortBy;
    sortOrder: SortOrder;
    onSortChange: (column: SortBy) => void;
    canRetry: boolean;
    onRetryScheduled: (repoId: number, jobId: string) => void;
}): ColumnDef<DisplayedRepo>[] => [
        {
            id: "name",
            accessorFn: getRepoName,
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
                const repo = row.original;
                const displayName = getRepoName(repo);
                const codeHostIcon = getCodeHostIcon(repo.codeHostType);
                const repoImageSrc = repo.imageUrl
                    ? getRepoImageSrc(repo.imageUrl, repo.id)
                    : undefined;
                const isInternalApiImage = repoImageSrc?.startsWith("/api/");
                const repoBrowseUrl = repo.indexedCommitHash
                    ? getBrowsePath({
                          repoName: repo.name,
                          path: "",
                          pathType: "tree",
                      })
                    : null;

                return (
                    <div className="flex min-w-0 items-center gap-2">
                        {repoImageSrc ? (
                            <Image
                                src={repoImageSrc}
                                alt={`${displayName} logo`}
                                width={32}
                                height={32}
                                className="shrink-0 rounded-md object-cover"
                                unoptimized={isInternalApiImage}
                            />
                        ) : (
                            <Image
                                src={codeHostIcon.src}
                                alt={`${displayName} logo`}
                                width={32}
                                height={32}
                                className={cn("shrink-0 rounded-md", codeHostIcon.className)}
                            />
                        )}
                        {repoBrowseUrl ? (
                            <Link
                                href={repoBrowseUrl}
                                className="min-w-0 flex-1 truncate font-medium hover:underline"
                            >
                                {displayName}
                            </Link>
                        ) : (
                            <span className="min-w-0 flex-1 truncate font-medium">
                                {displayName}
                            </span>
                        )}
                        <SyncAnnotationBadge
                            repo={repo}
                            canRetry={canRetry}
                            onRetryScheduled={onRetryScheduled}
                            showCompleted={repo.showCompleted}
                            showExplicitSyncing={repo.showExplicitSyncing}
                        />
                    </div>
                );
            },
        },
        {
            accessorKey: "indexedAt",
            header: () => (
                <SortableHeader
                    label="Last synced"
                    column="indexedAt"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSortChange={onSortChange}
                    tooltip="When this repository was last successfully synced."
                />
            ),
            cell: ({ row }) => {
                const indexedAt = row.original.indexedAt;
                return indexedAt ? <DisplayDate date={indexedAt} /> : "-";
            },
        },
        {
            accessorKey: "indexedCommitHash",
            header: "Synced commit",
            cell: ({ row }) => {
                const hash = row.original.indexedCommitHash;
                if (!hash) {
                    return "-";
                }

                const repo = row.original;
                const shortHash = hash.slice(0, 7);
                const commitUrl = getBrowsePath({
                    repoName: repo.name,
                    path: "",
                    pathType: "commit",
                    commitSha: hash,
                });
                const hashElement = (
                    <Link
                        href={commitUrl}
                        className="font-mono text-sm text-link hover:underline"
                    >
                        {shortHash}
                    </Link>
                );

                return (
                    <Tooltip>
                        <TooltipTrigger asChild>{hashElement}</TooltipTrigger>
                        <TooltipContent>
                            <span className="font-mono">{hash}</span>
                        </TooltipContent>
                    </Tooltip>
                );
            },
        },
        {
            id: "actions",
            header: () => <span className="sr-only">Actions</span>,
            cell: ({ row }) => (
                <div className="flex justify-end">
                    <RepoActionsMenu
                        repo={row.original}
                        canSync={canRetry}
                        isSyncing={row.original.showExplicitSyncing}
                        onSyncScheduled={onRetryScheduled}
                    />
                </div>
            ),
        },
    ];

type ReposTableProps = {
    data: Repo[];
    currentPage: number;
    pageSize: number;
    totalCount: number;
    canRetry: boolean;
    sortBy: SortBy;
    sortOrder: SortOrder;
};

export const ReposTable = ({
    data,
    currentPage,
    pageSize,
    totalCount,
    canRetry,
    sortBy,
    sortOrder,
}: ReposTableProps) => {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const searchParamsString = searchParams.toString();
    const urlSearchValue = searchParams.get("search") ?? "";
    const statusFilter = getStatusFilter(searchParams.get("status"));
    const [searchValue, setSearchValue] = useState(urlSearchValue);
    const [scheduledRetryJobs, setScheduledRetryJobs] = useState<
        Map<number, WorkloadJob<"repo-index">>
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
        startSearchTransition,
        urlSearchValue,
    ]);
    const onRetryScheduled = useCallback((repoId: number, jobId: string) => {
        setScheduledRetryJobs((currentJobs) => {
            const nextJobs = new Map(currentJobs);
            nextJobs.set(repoId, {
                id: jobId,
                data: { repoId, type: "INDEX" },
                status: "PENDING",
                errorMessage: null,
            });
            return nextJobs;
        });
    }, []);
    const retryAwareData = useMemo(
        () => data.map((repo) => {
            const scheduledJob = scheduledRetryJobs.get(repo.id);
            return scheduledJob
                ? { ...repo, latestJob: scheduledJob }
                : repo;
        }),
        [data, scheduledRetryJobs],
    );
    const pollingTargets = useMemo(
        () => retryAwareData.flatMap((repo) => {
            const scheduledJob = scheduledRetryJobs.get(repo.id);
            return scheduledJob || getSyncAnnotation(repo) === "SYNCING"
                ? [{ repoId: repo.id, jobId: repo.latestJob?.id ?? null }]
                : [];
        }),
        [retryAwareData, scheduledRetryJobs],
    );
    const pollingRepoIds = useMemo(
        () => pollingTargets.map(({ repoId }) => repoId),
        [pollingTargets],
    );
    const pollingKey = useMemo(
        () => pollingTargets.map(({ repoId, jobId }) => `${repoId}:${jobId}`),
        [pollingTargets],
    );
    const { data: polledStatuses } = useQuery({
        queryKey: ["reposv2-indexing-status", pollingRepoIds, pollingKey],
        queryFn: ({ signal }) => getRepoIndexingStatuses(pollingRepoIds, signal),
        enabled: pollingRepoIds.length > 0,
        placeholderData: (previousData) => previousData,
        refetchInterval: (query) => {
            const statuses = query.state.data?.repositories;
            if (!statuses) {
                return POLL_INTERVAL_MS;
            }

            return pollingTargets.some((target) => {
                const status = statuses.find(
                    ({ repoId }) => repoId === target.repoId,
                );
                if (!status) {
                    return true;
                }

                const latestJob = status.latestJob;
                const isLatestIndexJob = latestJob?.data.repoId === status.repoId
                    && latestJob.data.type === "INDEX";
                const expectedJobId = target.jobId;

                if (expectedJobId && latestJob?.id !== expectedJobId) {
                    return true;
                }

                if (expectedJobId) {
                    return latestJob?.status === "PENDING"
                        || latestJob?.status === "IN_PROGRESS";
                }

                return !status.indexedAt
                    && (
                        !isLatestIndexJob
                        || latestJob.status === "PENDING"
                        || latestJob.status === "IN_PROGRESS"
                    );
            })
                ? POLL_INTERVAL_MS
                : false;
        },
    });
    const completedDuringPollingRepoIds = useMemo(() => {
        const pollingTargetsByRepoId = new Map(
            pollingTargets.map((target) => [target.repoId, target]),
        );
        return new Set(
            polledStatuses?.repositories.flatMap((status) => {
                const target = pollingTargetsByRepoId.get(status.repoId);
                const isExpectedJob = !target?.jobId
                    || status.latestJob?.id === target.jobId;
                return target
                    && isExpectedJob
                    && status.latestJob?.status === "COMPLETED"
                    && status.indexedAt
                    ? [status.repoId]
                    : [];
            }) ?? [],
        );
    }, [polledStatuses, pollingTargets]);
    const displayedData = useMemo(() => {
        const statusesByRepoId = new Map(
            polledStatuses?.repositories.map((status) => [
                status.repoId,
                status,
            ]) ?? [],
        );
        return retryAwareData.map((repo): DisplayedRepo => {
            const showCompleted = completedDuringPollingRepoIds.has(repo.id);
            const status = statusesByRepoId.get(repo.id);
            const scheduledJob = scheduledRetryJobs.get(repo.id);
            const showExplicitSyncing = Boolean(
                scheduledJob
                && (
                    !status
                    || status.latestJob?.id !== scheduledJob.id
                    || status.latestJob.status === "PENDING"
                    || status.latestJob.status === "IN_PROGRESS"
                ),
            );
            if (!status) {
                return { ...repo, showCompleted, showExplicitSyncing };
            }
            if (scheduledJob && status.latestJob?.id !== scheduledJob.id) {
                return { ...repo, showCompleted, showExplicitSyncing };
            }

            return {
                ...repo,
                indexedAt: status.indexedAt
                    ? new Date(status.indexedAt)
                    : null,
                indexedCommitHash: status.indexedCommitHash,
                latestJob: status.latestJob,
                showCompleted,
                showExplicitSyncing,
            };
        });
    }, [
        completedDuringPollingRepoIds,
        polledStatuses,
        retryAwareData,
        scheduledRetryJobs,
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
            canRetry,
            onRetryScheduled,
        }),
        [
            canRetry,
            onRetryScheduled,
            onSortChange,
            sortBy,
            sortOrder,
        ],
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
    const firstVisibleRepo = totalCount === 0
        ? 0
        : (currentPage - 1) * pageSize + 1;
    const lastVisibleRepo = Math.min(currentPage * pageSize, totalCount);

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

    const emptyMessage = statusFilter === "failed"
        ? "No failed repositories."
        : statusFilter === "warning"
            ? "No repositories with warnings."
            : "No repositories found.";

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
                        placeholder="Search repositories..."
                    />
                    {isSearchPending && (
                        <InputGroupAddon align="inline-end">
                            <Loader2
                                className="h-4 w-4 animate-spin"
                                aria-label="Searching repositories"
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
                        aria-label="Filter repositories by status"
                    >
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Filter by status</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                    </SelectContent>
                </Select>
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
                                            header.column.id === "indexedAt" && "w-56",
                                            header.column.id === "indexedCommitHash" && "w-40",
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
                                                cell.column.id === "indexedAt" && "w-56 whitespace-nowrap",
                                                cell.column.id === "indexedCommitHash" && "w-40 whitespace-nowrap",
                                                cell.column.id === "actions" && "w-12 px-2",
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
                                    {emptyMessage}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            {totalCount > 0 && (
                <div className="flex items-center justify-between py-4">
                    <p className="text-sm text-muted-foreground">
                        Showing {firstVisibleRepo}-{lastVisibleRepo} of {totalCount}
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
