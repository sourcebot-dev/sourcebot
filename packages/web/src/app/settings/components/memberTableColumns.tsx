'use client'

import { Column, ColumnDef } from "@tanstack/react-table"

export type MemberColumnInfo = {
    name: string;
    role: string;
}

export const memberTableColumns = (): ColumnDef<MemberColumnInfo>[] => {
    return [
        {
            accessorKey: "name",
            cell: ({ row }) => {
                const member = row.original;
                return <div>{member.name}</div>;
            }
        },
        {
            accessorKey: "role",
            cell: ({ row }) => {
                const member = row.original;
                return <div>{member.role}</div>;
            }
        }
    ]
}