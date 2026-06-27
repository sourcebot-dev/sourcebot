"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
    type Column,
    type ColumnDef,
    type OnChangeFn,
    type RowData,
    type SortingFn,
    type SortingState,
    flexRender,
    functionalUpdate,
    getCoreRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

declare module "@tanstack/react-table" {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface ColumnMeta<TData extends RowData, TValue> {
        className?: string;
    }
}
import { ArrowDown, ArrowUp, Info } from "lucide-react";
import { OrgRole } from "@sourcebot/db";
import { UserAvatar } from "@/components/userAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DisplayDate } from "@/app/(app)/components/DisplayDate";
import { NotificationDot } from "@/app/(app)/components/notificationDot";
import { cn } from "@/lib/utils";
import { MembersTableActions, type MembersTableActionsProps } from "./membersTableActions";

// Matches the `lastActiveAt` write throttle in withAuth: a member seen within
// this window is treated as currently online.
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

// --- Input shapes (mirrors the membership action DTOs) ---------------------

export type Member = {
    id: string;
    email: string;
    name?: string;
    avatarUrl?: string;
    role: OrgRole;
    joinedAt: Date;
    suspendedAt?: Date | null;
    scimManaged: boolean;
    lastActiveAt?: Date | null;
};

export type Invite = {
    id: string;
    email: string;
    createdAt: Date;
};

export type Request = {
    id: string;
    email: string;
    createdAt: Date;
    name?: string;
    image?: string;
};

// --- Unified row model -----------------------------------------------------

export type Section = "active" | "pending" | "suspended" | "invited" | "requests";

type MemberRow = Member & { kind: "member"; section: Extract<Section, "active" | "pending" | "suspended"> };
type InviteRow = Invite & { kind: "invite"; section: "invited" };
type RequestRow = Request & { kind: "request"; section: "requests" };
export type TableRowData = MemberRow | InviteRow | RequestRow;
export type MemberFilter = "all" | "owners" | "members" | Section;

const SECTIONS: { id: Section; label: string; description: string }[] = [
    {
        id: "requests",
        label: "Requests",
        description: "People who requested access to the organization.",
    },
    {
        id: "active",
        label: "Active",
        description: "Users who have access to the organization. Active users count toward billing.",
    },
    {
        id: "pending",
        label: "Pending",
        description: "Users who have access to the organization but have never signed in. Pending users do not count toward billing.",
    },
    {
        id: "suspended",
        label: "Suspended",
        description: "Users who cannot access the organization. Suspended users do not count toward billing.",
    },
    {
        id: "invited",
        label: "Invited",
        description: "People with pending invitations to the organization.",
    },
];

const COLUMN_WIDTHS = ["auto", "180px", "120px", "120px", "120px", "64px"];

const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
});

export const getDisplayName = (row: TableRowData) => {
    if (row.kind === "invite") {
        return row.email;
    }
    return row.name ?? row.email;
};

const getRoleLabel = (row: TableRowData) => {
    if (row.kind === "member") {
        return row.role.toLowerCase();
    }
    return "";
};

const getStatusLabel = (row: TableRowData) => {
    if (row.kind === "member") {
        return row.section;
    }
    return row.kind === "invite" ? "invited" : "requested";
};

const getJoinedTime = (row: TableRowData) => {
    return (row.kind === "member" ? row.joinedAt : row.createdAt).getTime();
};

const getLastSeenTime = (row: TableRowData) => {
    if (row.kind !== "member" || row.lastActiveAt == null) {
        return Number.NEGATIVE_INFINITY;
    }
    return row.lastActiveAt.getTime();
};

export const rowMatchesFilter = (row: TableRowData, filter: MemberFilter) => {
    if (filter === "all") {
        return true;
    }
    if (filter === "owners") {
        return row.kind === "member" && row.role === OrgRole.OWNER;
    }
    if (filter === "members") {
        return row.kind === "member" && row.role === OrgRole.MEMBER;
    }
    return row.section === filter;
};

export const rowMatchesSearch = (row: TableRowData, searchQuery: string) => {
    const query = searchQuery.trim().toLowerCase();
    if (query.length === 0) {
        return true;
    }

    return getDisplayName(row).toLowerCase().includes(query) || row.email.toLowerCase().includes(query);
};

const compareByName = (a: TableRowData, b: TableRowData) => {
    return collator.compare(getDisplayName(a), getDisplayName(b)) || collator.compare(a.email, b.email);
};

const sortByName: SortingFn<TableRowData> = (rowA, rowB) => {
    return compareByName(rowA.original, rowB.original);
};

const sortByStatus: SortingFn<TableRowData> = (rowA, rowB) => {
    return collator.compare(getStatusLabel(rowA.original), getStatusLabel(rowB.original))
        || compareByName(rowA.original, rowB.original);
};

const sortByRole: SortingFn<TableRowData> = (rowA, rowB) => {
    return collator.compare(getRoleLabel(rowA.original), getRoleLabel(rowB.original))
        || compareByName(rowA.original, rowB.original);
};

const sortByJoined: SortingFn<TableRowData> = (rowA, rowB) => {
    return getJoinedTime(rowA.original) - getJoinedTime(rowB.original)
        || compareByName(rowA.original, rowB.original);
};

const sortByLastSeen: SortingFn<TableRowData> = (rowA, rowB) => {
    return getLastSeenTime(rowA.original) - getLastSeenTime(rowB.original)
        || compareByName(rowA.original, rowB.original);
};

const SortableHeader = ({
    column,
    children,
}: {
    column: Column<TableRowData, unknown>;
    children: string;
}) => {
    const sortDirection = column.getIsSorted();
    const Icon = sortDirection === "asc" ? ArrowDown : sortDirection === "desc" ? ArrowUp : ArrowDown;

    return (
        <Button
            variant="ghost"
            className="group -ml-3 h-8 px-3 gap-0 [&_svg]:size-3"
            size="sm"
            onClick={() => column.toggleSorting(sortDirection === "asc")}
            aria-label={`Sort by ${children}`}
        >
            {children}
            <Icon
                className={cn(
                    "ml-1 transition-opacity",
                    sortDirection ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                )}
            />
        </Button>
    );
};

const ColumnWidths = () => (
    <colgroup>
        {COLUMN_WIDTHS.map((width, index) => (
            <col key={index} style={{ width }} />
        ))}
    </colgroup>
);

/**
 * Derives a member's section. Mirrors the `billedUserCount` query so the table
 * and the bill stay in lockstep:
 *  - suspended: membership is suspended (`suspendedAt != null`)
 *  - pending:   unsuspended but never signed in to this org (`lastActiveAt == null`)
 *  - active:    active and has signed in at least once
 */
export const getMemberSection = (member: Member): MemberRow["section"] => {
    if (member.suspendedAt != null) {
        return "suspended";
    }
    if (member.lastActiveAt == null) {
        return "pending";
    }
    return "active";
};

const getColumns = (actionContext: Omit<MembersTableActionsProps, "row">): ColumnDef<TableRowData>[] => [
    {
        id: "identity",
        accessorFn: getDisplayName,
        sortingFn: sortByName,
        header: ({ column }) => <SortableHeader column={column}>Name</SortableHeader>,
        cell: ({ row }) => {
            const r = row.original;
            const name = getDisplayName(r);
            const hasName = r.kind !== "invite" && r.name != null;
            const imageUrl = r.kind === "member" ? r.avatarUrl : r.kind === "request" ? r.image : undefined;
            return (
                <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar email={r.email} imageUrl={imageUrl} />
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium truncate">{name}</span>
                        </div>
                        {hasName && (
                            <div className="text-sm text-muted-foreground truncate">{r.email}</div>
                        )}
                    </div>
                </div>
            );
        },
    },
    {
        id: "role",
        accessorFn: getRoleLabel,
        meta: { className: "whitespace-nowrap" },
        sortingFn: sortByRole,
        header: ({ column }) => <SortableHeader column={column}>Role</SortableHeader>,
        cell: ({ row }) => {
            const r = row.original;
            if (r.kind === "member") {
                const roleLabel = r.role.toLowerCase();
                const stateLabel = r.section === "pending" || r.section === "suspended"
                    ? ` (${r.section})`
                    : "";

                return (
                    <Badge
                        variant={r.role === OrgRole.OWNER ? "default" : "secondary"}
                        className="capitalize rounded-sm"
                    >
                        {roleLabel}
                        {stateLabel}
                    </Badge>
                );
            }
            return <span className="text-sm text-muted-foreground">-</span>;
        },
    },
    {
        id: "status",
        accessorFn: getStatusLabel,
        meta: { className: "whitespace-nowrap" },
        sortingFn: sortByStatus,
        header: ({ column }) => <SortableHeader column={column}>Status</SortableHeader>,
        cell: ({ row }) => (
            <span className="text-sm text-muted-foreground capitalize">
                {getStatusLabel(row.original)}
            </span>
        ),
    },
    {
        id: "joined",
        accessorFn: getJoinedTime,
        meta: { className: "whitespace-nowrap" },
        sortingFn: sortByJoined,
        header: ({ column }) => <SortableHeader column={column}>Joined</SortableHeader>,
        cell: ({ row }) => {
            const r = row.original;
            if (r.kind !== "member") {
                return <span className="text-sm text-muted-foreground">—</span>;
            }

            return <DisplayDate date={r.joinedAt} />;
        },
    },
    {
        id: "lastActive",
        accessorFn: getLastSeenTime,
        meta: { className: "whitespace-nowrap" },
        sortingFn: sortByLastSeen,
        header: ({ column }) => <SortableHeader column={column}>Last seen</SortableHeader>,
        cell: ({ row }) => {
            const r = row.original;
            if (r.kind !== "member" || r.suspendedAt !== null) {
                return <span className="text-sm text-muted-foreground">—</span>;
            }
            if (!r.lastActiveAt) {
                return <span className="text-sm text-muted-foreground">Never</span>;
            }
            if (Date.now() - r.lastActiveAt.getTime() < ONLINE_THRESHOLD_MS) {
                return (
                    <div className="flex items-center gap-2">
                        <NotificationDot />
                        <span className="text-sm">Online</span>
                    </div>
                );
            }
            return <DisplayDate date={r.lastActiveAt} />;
        },
    },
    {
        id: "actions",
        meta: { className: "text-right" },
        enableSorting: false,
        header: "",
        cell: ({ row }) => (
            <MembersTableActions
                row={row.original}
                {...actionContext}
            />
        ),
    },
];

interface MembersTableProps {
    members: Member[];
    invites: Invite[];
    requests: Request[];
    filter: MemberFilter;
    searchQuery: string;
    onClearFilters: () => void;
    currentUserId: string;
    hasOrgManagement: boolean;
    scimEnabled: boolean;
}

export const MembersTable = ({
    members,
    invites,
    requests,
    filter,
    searchQuery,
    onClearFilters,
    currentUserId,
    hasOrgManagement,
    scimEnabled,
}: MembersTableProps) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const scrollTopBeforeSortRef = useRef<number | null>(null);
    const [sorting, setSorting] = useState<SortingState>([
        {
            id: "identity",
            desc: false,
        },
    ]);

    const data = useMemo<TableRowData[]>(() => {
        const memberRows: TableRowData[] = members.map((m) => ({
            ...m,
            kind: "member",
            section: getMemberSection(m),
        }));
        const inviteRows: TableRowData[] = invites.map((i) => ({ ...i, kind: "invite", section: "invited" }));
        const requestRows: TableRowData[] = requests.map((r) => ({ ...r, kind: "request", section: "requests" }));
        return [...memberRows, ...inviteRows, ...requestRows];
    }, [members, invites, requests]);

    const filteredData = useMemo(() => {
        return data.filter((row) => rowMatchesFilter(row, filter) && rowMatchesSearch(row, searchQuery));
    }, [data, filter, searchQuery]);

    const activeOwnerCount = useMemo(() => {
        return members.filter((member) =>
            member.suspendedAt == null &&
            member.lastActiveAt != null &&
            member.role === OrgRole.OWNER
        ).length;
    }, [members]);

    const columns = useMemo(() => getColumns({
        currentUserId,
        activeOwnerCount,
        hasOrgManagement,
        scimEnabled,
    }), [activeOwnerCount, currentUserId, hasOrgManagement, scimEnabled]);

    const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
        scrollTopBeforeSortRef.current = scrollContainerRef.current?.scrollTop ?? null;
        setSorting((previous) => functionalUpdate(updater, previous));
    };

    useLayoutEffect(() => {
        if (scrollTopBeforeSortRef.current == null || !scrollContainerRef.current) {
            return;
        }

        scrollContainerRef.current.scrollTop = scrollTopBeforeSortRef.current;
        scrollTopBeforeSortRef.current = null;
    }, [sorting]);

    useLayoutEffect(() => {
        if (!scrollContainerRef.current) {
            return;
        }

        scrollContainerRef.current.scrollTop = 0;
    }, [filter, searchQuery]);

    const table = useReactTable({
        data: filteredData,
        columns,
        state: {
            sorting,
        },
        onSortingChange: handleSortingChange,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    const rows = table.getRowModel().rows;
    const visibleSections = SECTIONS.map((section) => ({
        ...section,
        rows: rows.filter((row) => row.original.section === section.id),
    })).filter((section) => section.rows.length > 0);

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border">
            <div ref={scrollContainerRef} className="relative min-h-0 flex-1 overflow-auto">
                {/* Remove the collapsed `border-b` (from TableHeader/TableRow) so it doesn't
                    double up with the box-shadow divider at the top; the shadow is the sole
                    divider and it survives scrolling. */}
                <table className="sticky top-0 z-20 w-full table-fixed caption-bottom bg-background text-sm">
                    <ColumnWidths />
                    <TableHeader className="[&_tr]:border-b-0 shadow-[inset_0_-1px_0_0_var(--border)]">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id} className={header.column.columnDef.meta?.className}>
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                </table>
                {rows.length === 0 ? (
                    <table className="w-full table-fixed caption-bottom text-sm">
                        <ColumnWidths />
                        <TableBody>
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                                    <div className="flex flex-col items-center gap-3">
                                        <span>No rows match this filter.</span>
                                        <Button variant="outline" size="sm" onClick={onClearFilters}>
                                            Clear filter
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </table>
                ) : visibleSections.map((section) => (
                    <table key={section.id} className="w-full table-fixed caption-bottom text-sm">
                        <ColumnWidths />
                        <TableBody>
                            <TableRow className="border-b-0 hover:bg-transparent">
                                <TableCell
                                    colSpan={columns.length}
                                    className="sticky top-[47px] z-10 bg-muted py-1.5 shadow-[inset_0_-1px_0_0_var(--border)]"
                                >
                                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                        <span>{section.label}</span>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    type="button"
                                                    className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                                    aria-label={`${section.label} section info`}
                                                >
                                                    <Info className="h-3.5 w-3.5" />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipPrimitive.Portal>
                                                <TooltipContent className="max-w-xs">
                                                    {section.description}
                                                </TooltipContent>
                                            </TooltipPrimitive.Portal>
                                        </Tooltip>
                                        •
                                        <span>{section.rows.length}</span>
                                        {section.id === "requests" && (
                                            <NotificationDot />
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                            {section.rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className={cell.column.columnDef.meta?.className}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </table>
                ))}
            </div>
        </div>
    );
};
