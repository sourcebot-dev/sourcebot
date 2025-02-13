'use client'

import { Button } from "@/components/ui/button"
import { ColumnDef } from "@tanstack/react-table"

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
        },
        {
            id: "remove",
            cell: () => {
                return (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            // TODO: Implement remove member action
                        }}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-red-400 hover:text-red-600 transition-colors"
                        >
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                    </Button>
                );
            }
        }
    ]
}