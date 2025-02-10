'use client'

import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table"
import { resolveServerPath } from "../../api/(client)/client";
import { createPathWithQueryParams } from "@/lib/utils";

export type InviteColumnInfo = {
    id: string;
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
        },
        {
            accessorKey: "copy",
            cell: ({ row }) => {
                const invite = row.original;
                return (
                    <Button
                        variant="link"
                        onClick={() => {
                            const basePath = `${window.location.origin}${resolveServerPath('/')}`;
                            const url = createPathWithQueryParams(`${basePath}redeem?invite_id=${invite.id}`);
                            navigator.clipboard.writeText(url);
                        }}
                    >
                        Copy
                    </Button>
                )
            }
        }
    ]
}