'use client';
import { useMemo } from "react";
import { DataTable } from "@/components/ui/data-table";
import { InviteColumnInfo, inviteTableColumns } from "./inviteTableColumns"

export interface InviteInfo {
    id: string;
    email: string;
    createdAt: Date;
}

interface InviteTableProps {
    initialInvites: InviteInfo[];
}

export const InviteTable = ({ initialInvites }: InviteTableProps) => {
    const inviteRows: InviteColumnInfo[] = useMemo(() => {
        return initialInvites.map(invite => {
            return {
                id: invite.id!,
                email: invite.email!,
                createdAt: invite.createdAt!,
            }
        })
    }, [initialInvites]);

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