'use client';
import { useEffect, useMemo, useState } from "react";
import { User } from "@sourcebot/db";
import { DataTable } from "@/components/ui/data-table";
import { InviteColumnInfo, inviteTableColumns } from "./inviteTableColumns"

export interface InviteInfo {
    email: string;
    createdAt: Date;
}

interface InviteTableProps {
    initialInvites: InviteInfo[];
}

export const InviteTable = ({ initialInvites }: InviteTableProps) => {
    const [invites, setInvites] = useState<InviteInfo[]>(initialInvites);
    
    const inviteRows: InviteColumnInfo[] = useMemo(() => {
        return invites.map(invite => {
            return {
                email: invite.email!,
                createdAt: invite.createdAt!,
            }
        })
    }, [invites]);

    return (
        <div>
            <DataTable
                columns={inviteTableColumns()}
                data={inviteRows}
                searchKey="email"
                searchPlaceholder="Search invites..."
            />
        </div>
    )
}