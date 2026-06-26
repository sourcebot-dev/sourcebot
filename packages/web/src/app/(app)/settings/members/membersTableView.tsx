"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MembersFilterSelect } from "./membersFilterSelect";
import { InviteMembersDialog } from "./inviteMembersDialog";
import {
    MembersTable,
    type Invite,
    type Member,
    type MemberFilter,
    type Request,
} from "./membersTable";

interface MembersTableViewProps {
    members: Member[];
    invites: Invite[];
    requests: Request[];
    currentUserId: string;
    hasOrgManagement: boolean;
    scimEnabled: boolean;
}

export const MembersTableView = ({
    members,
    invites,
    requests,
    currentUserId,
    hasOrgManagement,
    scimEnabled,
}: MembersTableViewProps) => {
    const [filter, setFilter] = useState<MemberFilter>("all");
    const [searchQuery, setSearchQuery] = useState("");

    const clearFilters = () => {
        setFilter("all");
        setSearchQuery("");
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
                <MembersFilterSelect value={filter} onValueChange={setFilter} />
                <InviteMembersDialog className="ml-auto" />
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
