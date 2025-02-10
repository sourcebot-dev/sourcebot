'use client'

import { ColumnDef } from "@tanstack/react-table"

export type InviteColumnInfo = {
    email: string;
    createdAt: Date;
}

export const inviteTableColumns = (): ColumnDef<InviteColumnInfo>[] => {
    return [
        {
            accessorKey: "email",
            cell: ({ row }) => {
                const invite = row.original;
                return <div>{invite.email}</div>;
            }
        },
        {
            accessorKey: "createdAt",
            cell: ({ row }) => {
                const invite = row.original;
                return invite.createdAt.toISOString();
            }
        }
    ]
}