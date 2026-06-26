"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDebounce } from "@uidotdev/usehooks";
import { OrgRole } from "@sourcebot/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MembersFilterSelect } from "./membersFilterSelect";
import { InviteMembersDialog } from "./inviteMembersDialog";
import {
    MembersTable,
    getMemberSection,
    type Invite,
    type Member,
    type MemberFilter,
    type Request,
    type TableRowData,
} from "./membersTable";

interface MembersTableViewProps {
    members: Member[];
    invites: Invite[];
    requests: Request[];
    currentUserId: string;
    hasOrgManagement: boolean;
    scimEnabled: boolean;
}

const FILTER_QUERY_PARAM = "filter";
const SEARCH_QUERY_PARAM = "search";

const isMemberFilter = (value: string | null): value is MemberFilter => {
    return value === "all"
        || value === "owners"
        || value === "members"
        || value === "active"
        || value === "pending"
        || value === "suspended"
        || value === "invited"
        || value === "requests";
};

const csvEscape = (value: string | number | null | undefined) => {
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
};

const downloadCsv = (filename: string, rows: string[][]) => {
    const csv = rows
        .map((row) => row.map(csvEscape).join(","))
        .join("\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
};

export const MembersTableView = ({
    members,
    invites,
    requests,
    currentUserId,
    hasOrgManagement,
    scimEnabled,
}: MembersTableViewProps) => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const urlFilter = searchParams.get(FILTER_QUERY_PARAM);
    const urlSearchQuery = searchParams.get(SEARCH_QUERY_PARAM) ?? "";
    const urlMemberFilter = isMemberFilter(urlFilter) ? urlFilter : "all";
    const [filter, setFilter] = useState<MemberFilter>(urlMemberFilter);
    const [searchQuery, setSearchQuery] = useState(urlSearchQuery);
    const debouncedSearchQuery = useDebounce(searchQuery, 300);
    const searchParamsString = searchParams.toString();
    const rows = useMemo<TableRowData[]>(() => {
        const memberRows: TableRowData[] = members.map((member) => ({
            ...member,
            kind: "member",
            section: getMemberSection(member),
        }));
        const inviteRows: TableRowData[] = invites.map((invite) => ({
            ...invite,
            kind: "invite",
            section: "invited",
        }));
        const requestRows: TableRowData[] = requests.map((request) => ({
            ...request,
            kind: "request",
            section: "requests",
        }));

        return [...memberRows, ...inviteRows, ...requestRows];
    }, [invites, members, requests]);

    useEffect(() => {
        setFilter(urlMemberFilter);
        setSearchQuery(urlSearchQuery);
    }, [urlMemberFilter, urlSearchQuery]);

    const updateUrlFilters = useCallback((nextFilter: MemberFilter, nextSearchQuery: string) => {
        const nextParams = new URLSearchParams(searchParamsString);
        const trimmedSearchQuery = nextSearchQuery.trim();

        if (nextFilter === "all") {
            nextParams.delete(FILTER_QUERY_PARAM);
        } else {
            nextParams.set(FILTER_QUERY_PARAM, nextFilter);
        }

        if (trimmedSearchQuery.length === 0) {
            nextParams.delete(SEARCH_QUERY_PARAM);
        } else {
            nextParams.set(SEARCH_QUERY_PARAM, trimmedSearchQuery);
        }

        const nextQueryString = nextParams.toString();
        const currentQueryString = searchParamsString;
        if (nextQueryString === currentQueryString) {
            return;
        }

        router.replace(`${pathname}${nextQueryString ? `?${nextQueryString}` : ""}`, { scroll: false });
    }, [pathname, router, searchParamsString]);

    useEffect(() => {
        if (debouncedSearchQuery !== searchQuery) {
            return;
        }

        updateUrlFilters(filter, debouncedSearchQuery);
    }, [debouncedSearchQuery, filter, searchQuery, updateUrlFilters]);

    const handleFilterChange = (nextFilter: MemberFilter) => {
        setFilter(nextFilter);
        updateUrlFilters(nextFilter, searchQuery);
    };

    const clearFilters = () => {
        setFilter("all");
        setSearchQuery("");
        updateUrlFilters("all", "");
    };

    const handleExportCsv = () => {
        const csvRows = [
            ["Name", "Email", "Role", "Status", "Joined", "Last seen"],
            ...rows.map((row) => [
                row.kind === "invite" ? "" : row.name ?? "",
                row.email,
                row.kind === "member"
                    ? row.role === OrgRole.OWNER ? "Owner" : "Member"
                    : "-",
                row.kind === "request" ? "Requested" : row.section[0].toUpperCase() + row.section.slice(1),
                (row.kind === "member" ? row.joinedAt : row.createdAt).toISOString(),
                row.kind !== "member"
                    ? ""
                    : row.lastActiveAt?.toISOString() ?? "Never",
            ]),
        ];

        downloadCsv(`${new Date().toISOString().slice(0, 10)}-members.csv`, csvRows);
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex items-center gap-2">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search by name or email"
                        className="pl-9"
                    />
                </div>
                <MembersFilterSelect value={filter} onValueChange={handleFilterChange} />
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    onClick={handleExportCsv}
                    disabled={rows.length === 0}
                >
                    Export CSV
                </Button>
                <InviteMembersDialog />
            </div>
            <MembersTable
                members={members}
                invites={invites}
                requests={requests}
                filter={filter}
                searchQuery={searchQuery}
                onClearFilters={clearFilters}
                currentUserId={currentUserId}
                hasOrgManagement={hasOrgManagement}
                scimEnabled={scimEnabled}
            />
        </div>
    );
};
